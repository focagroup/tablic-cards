package app.tablic.desktop;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import app.tablic.core.Bot;
import app.tablic.core.Card;
import app.tablic.core.Game;

/** Plays many bot-only games and checks invariants plus hand-made rule cases. */
public final class SimTest {
    static int failures = 0;

    static void check(boolean ok, String msg) {
        if (!ok) { failures++; System.out.println("FAIL: " + msg); }
    }

    public static void main(String[] args) {
        ruleCases();
        Random rng = new Random(42);
        int games = 0;
        long[] winsByLevel = new long[3];
        long[] gamesByLevelPair = new long[3];
        long tablas = 0, hands = 0;
        int[][] setups = {{2, 1}, {3, 1}, {4, 1}, {4, 0}};
        for (int[] su : setups) {
            for (int len = 0; len < 2; len++) {
                for (int i = 0; i < 250; i++) {
                    Game.Config c = new Game.Config();
                    c.players = su[0];
                    c.teams = su[1] == 1;
                    c.longGame = len == 1;
                    Game g = new Game(c, rng);
                    int players = c.players;
                    int[] level = new int[players];
                    for (int s = 0; s < players; s++) level[s] = players == 2 ? (s == 0 ? 2 : i % 2) : rng.nextInt(3);
                    int guard = 0;
                    checkDeal(g);
                    while (g.phase != Game.Phase.GAME_OVER && guard++ < 100000) {
                        if (g.phase == Game.Phase.ROUND_END) {
                            checkRoundEnd(g);
                            hands++;
                            g.nextRound();
                            checkDeal(g);
                            continue;
                        }
                        checkConservation(g);
                        int s = g.turn;
                        Bot.Choice ch = Bot.choose(g, s, level[s], rng);
                        int before = 0;
                        for (int t : g.tablas) before += t;
                        String err = g.play(s, ch.card, ch.capture);
                        check(err == null, "bot move rejected: " + err);
                        if (err != null) break;
                        int after = 0;
                        for (int t : g.tablas) after += t;
                        tablas += after - before;
                    }
                    check(g.phase == Game.Phase.GAME_OVER, "game did not finish");
                    checkRoundEnd(g);
                    hands++;
                    if (c.longGame) check(g.winner >= 0 && g.totals[g.winner] >= Game.LONG_TARGET, "long game winner below 101");
                    if (players == 2 && g.winner >= 0) {
                        if (level[1] == 0) { gamesByLevelPair[0]++; if (g.winner == 0) winsByLevel[0]++; }
                        else { gamesByLevelPair[1]++; if (g.winner == 0) winsByLevel[1]++; }
                    }
                    games++;
                }
            }
        }
        System.out.println("simulated " + games + " games, " + hands + " hands, " + tablas + " tablas");
        System.out.println("2p: hard beats easy " + winsByLevel[0] + "/" + gamesByLevelPair[0]
                + ", hard beats normal " + winsByLevel[1] + "/" + gamesByLevelPair[1]);
        duel(2, 1, 2000, rng);
        duel(1, 0, 2000, rng);
        System.out.println(failures == 0 ? "ALL OK" : failures + " FAILURES");
        if (failures > 0) System.exit(1);
    }

    /** Short 2-player games, levels a vs b with alternating seats; prints a's share of the points. */
    static void duel(int a, int b, int games, Random rng) {
        long pa = 0, pb = 0, wa = 0, wb = 0;
        for (int i = 0; i < games; i++) {
            Game.Config c = new Game.Config();
            Game g = new Game(c, rng);
            int[] level = i % 2 == 0 ? new int[]{a, b} : new int[]{b, a};
            while (g.phase == Game.Phase.PLAYING) {
                Bot.Choice ch = Bot.choose(g, g.turn, level[g.turn], rng);
                g.play(g.turn, ch.card, ch.capture);
            }
            int sa = i % 2, sb = 1 - sa;
            pa += g.totals[sa]; pb += g.totals[sb];
            if (g.winner == sa) wa++; else if (g.winner == sb) wb++;
        }
        System.out.printf("level %d vs %d: wins %d:%d, points %.1f:%.1f per hand%n", a, b, wa, wb, pa / (double) games, pb / (double) games);
    }

    static void checkDeal(Game g) {
        int expect = g.n == 3 ? 6 : 6;
        for (List<Integer> h : g.hands) check(h.size() == expect, "first deal size " + h.size());
        check(g.table.size() == 4, "table starts with 4 cards");
        check(g.deck.size() == 52 - 4 - 6 * g.n, "deck after first deal");
    }

    static void checkConservation(Game g) {
        boolean[] seen = new boolean[52];
        int count = 0;
        List<Integer> all = new ArrayList<>(g.deck);
        all.addAll(g.table);
        for (List<Integer> h : g.hands) all.addAll(h);
        for (List<Integer> p : g.piles) all.addAll(p);
        for (int c : all) { check(!seen[c], "duplicate card " + c); seen[c] = true; count++; }
        check(count == 52, "card count " + count);
    }

    static void checkRoundEnd(Game g) {
        int sum = 0;
        for (List<Integer> p : g.piles) sum += p.size();
        check(sum == 52 || g.lastCapturer < 0, "piles do not hold 52 cards at hand end: " + sum);
        int pts = 0, most = 0;
        for (Game.TeamResult r : g.lastResult) {
            pts += r.total - r.tablas;
            most += r.ptMostCards;
        }
        check(pts == 22 + most, "hand points " + pts + " (expected 22 + most cards " + most + ")");
        check(most == 0 || most == 3, "most cards bonus " + most);
    }

    static List<Integer> list(int... ids) {
        List<Integer> l = new ArrayList<>();
        for (int i : ids) l.add(i);
        return l;
    }

    static int[] arr(int... ids) { return ids; }

    static void ruleCases() {
        int S = Card.SPADES, H = Card.HEARTS, D = Card.DIAMONDS, C = Card.CLUBS;
        // 2, 3, 4, 7 on the table, a 9 takes 2+3+4 or 2+7, but not both (the 2 is shared).
        List<Integer> t = list(Card.id(S, 2), Card.id(H, 3), Card.id(D, 4), Card.id(C, 7));
        int nine = Card.id(H, 9);
        check(Game.isValidCapture(t, nine, arr(Card.id(S, 2), Card.id(H, 3), Card.id(D, 4))), "9 takes 2+3+4");
        check(Game.isValidCapture(t, nine, arr(Card.id(S, 2), Card.id(C, 7))), "9 takes 2+7");
        check(!Game.isValidCapture(t, nine, arr(Card.id(S, 2), Card.id(H, 3), Card.id(D, 4), Card.id(C, 7))), "9 cannot take all four");
        check(!Game.isValidCapture(t, nine, arr(Card.id(H, 3), Card.id(D, 4))), "9 cannot take 3+4");
        check(Game.isValidCapture(t, nine, arr()), "capturing is optional");
        // Several separate groups at once: 9 takes 2+7 and 4+5.
        t = list(Card.id(S, 2), Card.id(C, 7), Card.id(D, 4), Card.id(H, 5), Card.id(S, 9));
        check(Game.isValidCapture(t, nine, arr(Card.id(S, 2), Card.id(C, 7), Card.id(D, 4), Card.id(H, 5), Card.id(S, 9))), "9 takes 2+7, 4+5 and 9");
        int[] best = Game.bestCapture(t, nine);
        check(best.length == 5, "best capture takes all five: " + best.length);
        // Face values: J 12, Q 13, K 14.
        t = list(Card.id(S, 5), Card.id(H, 7));
        check(Game.isValidCapture(t, Card.id(C, Card.JACK), arr(Card.id(S, 5), Card.id(H, 7))), "J (12) takes 5+7");
        t = list(Card.id(S, 3), Card.id(H, Card.ACE));
        check(Game.isValidCapture(t, Card.id(C, Card.KING), arr(Card.id(S, 3), Card.id(H, Card.ACE))), "K (14) takes 3 + Ace as 11");
        check(Game.isValidCapture(list(Card.id(S, Card.JACK), Card.id(H, Card.ACE)), Card.id(C, Card.QUEEN),
                arr(Card.id(S, Card.JACK), Card.id(H, Card.ACE))), "Q (13) takes J + Ace as 1");
        // A played Ace counts 1 or 11.
        t = list(Card.id(S, 5), Card.id(H, 6), Card.id(D, Card.ACE));
        int ace = Card.id(C, Card.ACE);
        check(Game.isValidCapture(t, ace, arr(Card.id(S, 5), Card.id(H, 6))), "Ace (11) takes 5+6");
        check(Game.isValidCapture(t, ace, arr(Card.id(D, Card.ACE))), "Ace takes Ace");
        check(Game.isValidCapture(t, ace, arr(Card.id(S, 5), Card.id(H, 6), Card.id(D, Card.ACE))), "Ace (11) takes 5+6 and Ace");
        check(!Game.isValidCapture(t, Card.id(C, 10), arr(Card.id(S, 5), Card.id(H, 6))), "10 cannot take 5+6");
        // A 10 does not take an Ace + 9? (1 + 9 = 10: yes it does.)
        check(Game.isValidCapture(list(Card.id(S, Card.ACE), Card.id(H, 9)), Card.id(C, 10), arr(Card.id(S, Card.ACE), Card.id(H, 9))), "10 takes Ace + 9");
        // Card not on the table / duplicates are rejected.
        check(!Game.isValidCapture(list(Card.id(S, 4)), Card.id(H, 4), arr(Card.id(D, 4))), "card not on table");
        check(!Game.isValidCapture(list(Card.id(S, 4)), Card.id(H, 4), arr(Card.id(S, 4), Card.id(S, 4))), "duplicate card");
        // Points: 22 counting points in the deck.
        int sum = 0;
        for (int c = 0; c < 52; c++) sum += Card.points(c);
        check(sum == 22, "deck has 22 counting points: " + sum);
        check(Card.points(Card.BIG_TEN) == 2 && Card.points(Card.LITTLE_TWO) == 1 && Card.points(Card.id(S, 2)) == 0, "special cards");
        // Best capture prefers points.
        t = list(Card.id(S, 3), Card.id(H, 5), Card.id(D, 8));
        best = Game.bestCapture(t, Card.id(C, 8));
        check(best.length == 3, "8 takes 8 and 3+5");
        t = list(Card.id(D, 10), Card.id(S, 4), Card.id(H, 6));
        best = Game.bestCapture(t, Card.id(C, 10));
        check(best.length == 3, "10 takes 10 and 4+6");
        // Deal sizes over a whole hand: 2p 4x6, 3p 6+6+4, 4p 2x6.
        for (int n = 2; n <= 4; n++) {
            Game.Config cfg = new Game.Config();
            cfg.players = n;
            Game g = new Game(cfg, new Random(n));
            int deals = 1;
            int lastSize = 6;
            while (g.phase == Game.Phase.PLAYING) {
                int seq = g.dealSeq;
                int s = g.turn;
                g.play(s, g.hands.get(s).get(0), new int[0]);
                if (g.dealSeq != seq && g.phase == Game.Phase.PLAYING) { deals++; lastSize = g.hands.get(g.turn).size(); }
            }
            int expDeals = n == 2 ? 4 : n == 3 ? 3 : 2, expLast = n == 3 ? 4 : 6;
            check(deals == expDeals && lastSize == expLast, n + " players: " + deals + " deals, last " + lastSize);
        }
        System.out.println("rule cases done");
    }
}
