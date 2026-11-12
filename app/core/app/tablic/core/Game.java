package app.tablic.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/** Rules engine for Tablić (Serbian rules). Not thread-safe; Room synchronizes. */
public final class Game {

    public enum Phase { PLAYING, ROUND_END, GAME_OVER }

    public static final int LONG_TARGET = 101;

    public static final class Config {
        public int players = 2;          // 2..4
        public boolean teams = true;     // only with 4 players: seats 0+2 vs 1+3
        public boolean longGame = false; // false = one hand (short game), true = first past 101

        public Config copy() {
            Config c = new Config();
            c.players = players; c.teams = teams; c.longGame = longGame;
            return c;
        }
    }

    /** Last move, used by clients for animation. */
    public static final class Move {
        public int seq, seat, card;
        public int[] capture = new int[0];
        public boolean tabla;
        /** Cards left on the table at the end of the hand, given to team `sweepTeam` (-1 = none). */
        public int[] sweep = new int[0];
        public int sweepTeam = -1;
    }

    public static final class TeamResult {
        public int cards, honours, tens, tablas;
        public boolean bigTen, littleTwo;
        public int ptMostCards, total;
    }

    public final Config cfg;
    public final int n;
    public final int nTeams;
    private final Random rng;

    public final List<Integer> deck = new ArrayList<>();
    public final List<List<Integer>> hands = new ArrayList<>();
    public final List<Integer> table = new ArrayList<>();
    public final List<List<Integer>> piles = new ArrayList<>(); // per team
    public final int[] tablas;
    public final int[] totals;
    public final List<int[]> history = new ArrayList<>(); // per hand: points per team

    public int dealer;
    public int turn;
    public int lastCapturer = -1;
    public int round = 0;
    public int dealSeq = 0;
    /** Winning team, or -1 (game running, or a drawn short game). */
    public int winner = -1;
    public Phase phase = Phase.PLAYING;
    public Move lastMove;
    public TeamResult[] lastResult;
    private int moveSeq = 0;

    public Game(Config cfg, Random rng) {
        this.cfg = cfg.copy();
        this.n = cfg.players;
        this.nTeams = n == 4 && cfg.teams ? 2 : n;
        this.rng = rng;
        this.tablas = new int[nTeams];
        this.totals = new int[nTeams];
        for (int i = 0; i < n; i++) hands.add(new ArrayList<Integer>());
        for (int i = 0; i < nTeams; i++) piles.add(new ArrayList<Integer>());
        this.dealer = rng.nextInt(n);
        startRound();
    }

    public int team(int seat) { return nTeams == n ? seat : seat % 2; }

    // ------------------------------------------------------------------ dealing

    private void startRound() {
        round++;
        for (List<Integer> h : hands) h.clear();
        for (List<Integer> p : piles) p.clear();
        Arrays.fill(tablas, 0);
        table.clear();
        lastCapturer = -1;
        lastResult = null;
        deck.clear();
        for (int i = 0; i < 52; i++) deck.add(i);
        Collections.shuffle(deck, rng);
        for (int i = 0; i < 4; i++) table.add(deck.remove(deck.size() - 1));
        dealHands();
        turn = (dealer + 1) % n;
        phase = Phase.PLAYING;
    }

    /** 6 cards each while possible (3 players get 4 in the last deal). */
    private void dealHands() {
        int per = Math.min(6, deck.size() / n);
        for (int k = 0; k < per; k++)
            for (int i = 1; i <= n; i++)
                hands.get((dealer + i) % n).add(deck.remove(deck.size() - 1));
        dealSeq++;
    }

    // ------------------------------------------------------------------ captures

    /**
     * All groups of table cards (bit masks over table positions) whose values add up to v.
     * Aces on the table count 1 or 11.
     */
    public static List<Long> groups(List<Integer> tbl, int v) {
        List<Long> out = new ArrayList<>();
        int m = Math.min(tbl.size(), 63);
        int[] val = new int[m];
        boolean[] ace = new boolean[m];
        for (int i = 0; i < m; i++) { val[i] = Card.value(tbl.get(i)); ace[i] = Card.isAce(tbl.get(i)); }
        groupDfs(val, ace, 0, 0L, 0, 0, v, out);
        return out;
    }

    private static void groupDfs(int[] val, boolean[] ace, int from, long mask, int sum, int aces, int v, List<Long> out) {
        for (int i = from; i < val.length; i++) {
            int s = sum + val[i];
            if (s > v) continue;
            int a = aces + (ace[i] ? 1 : 0);
            long nm = mask | (1L << i);
            // with k of the aces counted as 11 the sum is s + 10k
            if ((v - s) % 10 == 0 && (v - s) / 10 <= a) out.add(nm);
            groupDfs(val, ace, i + 1, nm, s, a, v, out);
        }
    }

    /** True if `mask` is exactly a union of disjoint groups from `gs`. */
    static boolean exactCover(long mask, List<Long> gs) {
        if (mask == 0) return true;
        long low = mask & -mask;
        for (long g : gs) {
            if ((g & low) != 0 && (g & ~mask) == 0 && exactCover(mask & ~g, gs)) return true;
        }
        return false;
    }

    /** Table positions of the given cards as a bit mask, or -1 if a card is missing or repeated. */
    static long maskOf(List<Integer> tbl, int[] cards) {
        long mask = 0;
        for (int c : cards) {
            int i = tbl.indexOf(c);
            if (i < 0 || i >= 63 || (mask & (1L << i)) != 0) return -1;
            mask |= 1L << i;
        }
        return mask;
    }

    public static boolean isValidCapture(List<Integer> tbl, int card, int[] capture) {
        if (capture.length == 0) return true;
        long mask = maskOf(tbl, capture);
        if (mask < 0) return false;
        for (int v : Card.values(card)) if (exactCover(mask, groups(tbl, v))) return true;
        return false;
    }

    /**
     * The most valuable legal capture for `card` (most points, then most cards; taking every
     * table card — a tabla — is always the maximum). Empty if the card takes nothing.
     */
    public static int[] bestCapture(List<Integer> tbl, int card) {
        long bestMask = 0, bestScore = 0;
        long full = tbl.size() >= 63 ? -1L >>> 1 : (1L << tbl.size()) - 1;
        for (int v : Card.values(card)) {
            List<Long> gs = groups(tbl, v);
            if (gs.isEmpty()) continue;
            Map<Long, long[]> memo = new HashMap<>();
            long[] r = pack(full, gs, tbl, memo);
            if (r[0] > bestScore) { bestScore = r[0]; bestMask = r[1]; }
        }
        return fromMask(tbl, bestMask);
    }

    /** Best set packing of groups inside `mask`: {score, chosen mask}. */
    private static long[] pack(long mask, List<Long> gs, List<Integer> tbl, Map<Long, long[]> memo) {
        if (mask == 0) return new long[]{0, 0};
        long[] hit = memo.get(mask);
        if (hit != null) return hit;
        long low = mask & -mask;
        long[] best = pack(mask & ~low, gs, tbl, memo); // leave the lowest card on the table
        for (long g : gs) {
            if ((g & low) == 0 || (g & ~mask) != 0) continue;
            long[] r = pack(mask & ~g, gs, tbl, memo);
            long sc = r[0] + score(tbl, g);
            if (sc > best[0]) best = new long[]{sc, r[1] | g};
        }
        memo.put(mask, best);
        return best;
    }

    private static long score(List<Integer> tbl, long g) {
        long s = 0;
        for (int i = 0; i < tbl.size() && i < 63; i++) if ((g & (1L << i)) != 0) s += 100L * Card.points(tbl.get(i)) + 1;
        return s;
    }

    static int[] fromMask(List<Integer> tbl, long mask) {
        int[] out = new int[Long.bitCount(mask)];
        int k = 0;
        for (int i = 0; i < tbl.size() && i < 63; i++) if ((mask & (1L << i)) != 0) out[k++] = tbl.get(i);
        return out;
    }

    /** Groups (as card ids) the played card could take, one list per possible value of the card. */
    public List<List<int[]>> captureGroups(int card) {
        List<List<int[]>> out = new ArrayList<>();
        for (int v : Card.values(card)) {
            List<int[]> l = new ArrayList<>();
            for (long g : groups(table, v)) l.add(fromMask(table, g));
            if (!l.isEmpty()) out.add(l);
        }
        return out;
    }

    /** Play a card, taking the given table cards (empty = the card stays on the table). Null on success. */
    public String play(int seat, int card, int[] capture) {
        if (phase != Phase.PLAYING) return "not_playing";
        if (seat != turn) return "not_your_turn";
        List<Integer> hand = hands.get(seat);
        if (!hand.contains(card)) return "no_such_card";
        if (capture == null) capture = new int[0];
        if (!isValidCapture(table, card, capture)) return "illegal_capture";

        hand.remove(Integer.valueOf(card));
        Move mv = new Move();
        mv.seq = ++moveSeq;
        mv.seat = seat;
        mv.card = card;
        mv.capture = capture.clone();
        int t = team(seat);
        if (capture.length > 0) {
            for (int c : capture) table.remove(Integer.valueOf(c));
            piles.get(t).add(card);
            for (int c : capture) piles.get(t).add(c);
            lastCapturer = seat;
            if (table.isEmpty() && !isRoundOver()) { // no tabla with the very last card of the hand
                tablas[t]++;
                mv.tabla = true;
            }
        } else {
            table.add(card);
        }
        lastMove = mv;

        turn = (turn + 1) % n;
        if (allHandsEmpty()) {
            if (!deck.isEmpty()) dealHands();
            else endRound();
        }
        return null;
    }

    private boolean allHandsEmpty() {
        for (List<Integer> h : hands) if (!h.isEmpty()) return false;
        return true;
    }

    public boolean isRoundOver() { return deck.isEmpty() && allHandsEmpty(); }

    // ------------------------------------------------------------------ scoring

    private void endRound() {
        if (!table.isEmpty() && lastCapturer >= 0) {
            int t = team(lastCapturer);
            lastMove.sweep = toArray(table);
            lastMove.sweepTeam = t;
            piles.get(t).addAll(table);
            table.clear();
        }
        TeamResult[] res = new TeamResult[nTeams];
        int[] cards = new int[nTeams];
        for (int t = 0; t < nTeams; t++) {
            TeamResult r = new TeamResult();
            for (int c : piles.get(t)) {
                r.cards++;
                int rk = Card.rank(c);
                if (rk >= Card.JACK) r.honours++;
                else if (rk == 10) r.tens += Card.points(c);
                if (c == Card.BIG_TEN) r.bigTen = true;
                if (c == Card.LITTLE_TWO) r.littleTwo = true;
            }
            r.tablas = tablas[t];
            cards[t] = r.cards;
            res[t] = r;
        }
        int w = uniqueMax(cards);
        if (w >= 0) res[w].ptMostCards = 3;
        int[] pts = new int[nTeams];
        for (int t = 0; t < nTeams; t++) {
            TeamResult r = res[t];
            r.total = r.honours + r.tens + (r.littleTwo ? 1 : 0) + r.ptMostCards + r.tablas;
            totals[t] += r.total;
            pts[t] = r.total;
        }
        history.add(pts);
        lastResult = res;
        dealer = (dealer + 1) % n;
        int top = uniqueMax(totals);
        if (!cfg.longGame) {
            winner = top; // -1 = draw
            phase = Phase.GAME_OVER;
        } else if (top >= 0 && totals[top] >= LONG_TARGET) {
            winner = top;
            phase = Phase.GAME_OVER;
        } else {
            phase = Phase.ROUND_END; // nobody at 101 yet, or a tie for the lead: play another hand
        }
    }

    static int uniqueMax(int[] v) {
        int best = Integer.MIN_VALUE, idx = -1;
        boolean tie = false;
        for (int i = 0; i < v.length; i++) {
            if (v[i] > best) { best = v[i]; idx = i; tie = false; }
            else if (v[i] == best) tie = true;
        }
        return tie ? -1 : idx;
    }

    public void nextRound() {
        if (phase == Phase.ROUND_END) startRound();
    }

    static int[] toArray(List<Integer> l) {
        int[] a = new int[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = l.get(i);
        return a;
    }
}
