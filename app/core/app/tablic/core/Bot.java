package app.tablic.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Heuristic bots. Level 0 = easy, 1 = normal, 2 = hard. */
public final class Bot {

    public static final class Choice {
        public final int card;
        public final int[] capture;
        Choice(int card, int[] capture) { this.card = card; this.capture = capture; }
    }

    private static final double CARD_WORTH = 0.15; // share of the 3 "most cards" points per card

    private Bot() {}

    public static Choice choose(Game g, int seat, int level, Random rng) {
        List<Integer> hand = g.hands.get(seat);
        List<Choice> moves = new ArrayList<>();
        for (int c : hand) {
            int[] best = Game.bestCapture(g.table, c);
            if (best.length > 0) moves.add(new Choice(c, best));
            moves.add(new Choice(c, new int[0]));
        }
        if (level <= 0 && rng.nextInt(100) < 40) return moves.get(rng.nextInt(moves.size()));

        int[] unseen = unseenByValue(g, seat);
        int unseenTotal = 0;
        for (int i = 2; i <= 14; i++) unseenTotal += unseen[i];
        int next = (seat + 1) % g.n;
        int oppHand = g.hands.get(next).size();
        if (oppHand == 0 && !g.deck.isEmpty()) oppHand = Math.min(6, g.deck.size() / g.n);
        boolean nextIsPartner = g.team(next) == g.team(seat);

        Choice best = null;
        double bestV = -1e9;
        for (Choice m : moves) {
            double v = evaluate(g, m, level, unseen, unseenTotal, oppHand, nextIsPartner);
            v += rng.nextDouble() * (level >= 1 ? 0.02 : 1.2);
            if (v > bestV) { bestV = v; best = m; }
        }
        return best;
    }

    private static double take(List<Integer> cards, int played) {
        double v = Card.points(played) + CARD_WORTH;
        for (int c : cards) v += Card.points(c) + CARD_WORTH;
        return v;
    }

    private static double evaluate(Game g, Choice m, int level, int[] unseen, int unseenTotal, int oppHand, boolean nextIsPartner) {
        List<Integer> rest = new ArrayList<>(g.table);
        double v;
        boolean lastPlay = g.deck.isEmpty();
        for (List<Integer> h : g.hands) if (h.size() > (h.contains(m.card) ? 1 : 0)) lastPlay = false;
        if (m.capture.length > 0) {
            List<Integer> caps = new ArrayList<>();
            for (int c : m.capture) { caps.add(c); rest.remove(Integer.valueOf(c)); }
            v = take(caps, m.card);
            if (rest.isEmpty() && !lastPlay) v += 1; // tabla
        } else {
            v = -0.05 * Card.points(m.card);
            if (Card.points(m.card) > 0) v -= 0.3; // keep counting cards in hand when possible
            rest.add(m.card);
        }
        if (level >= 1 && !rest.isEmpty() && !lastPlay && unseenTotal > 0) {
            // What can the next player take from the table we leave behind? Expected value of
            // their best capture: gains sorted high to low, each weighted by the chance that they
            // hold that value but none of the better ones.
            List<double[]> opts = new ArrayList<>(); // {gain, probability}
            for (int rank = 2; rank <= 14; rank++) {
                int k = unseen[rank];
                if (k == 0) continue;
                int[] cap = Game.bestCapture(rest, Card.id(0, rank));
                if (cap.length == 0) continue;
                List<Integer> capL = new ArrayList<>();
                for (int c : cap) capL.add(c);
                double gain = take(capL, Card.id(0, rank)) - Card.points(Card.id(0, rank)) + 0.5 * avgPoints(rank);
                if (cap.length == rest.size()) gain += 1; // tabla
                double p = 1 - Math.pow(1 - (double) k / unseenTotal, oppHand);
                opts.add(new double[]{gain, p});
            }
            java.util.Collections.sort(opts, new java.util.Comparator<double[]>() {
                @Override public int compare(double[] a, double[] b) { return Double.compare(b[0], a[0]); }
            });
            double expected = 0, none = 1;
            for (double[] o : opts) { expected += none * o[1] * o[0]; none *= 1 - o[1]; }
            double f = level >= 2 ? 0.9 : 0.75;
            v += nextIsPartner ? expected * 0.3 : -expected * f;
            if (level >= 2) {
                // Our own follow-up with the cards we keep, if the table survives the next turn.
                double follow = 0;
                List<Integer> keep = new ArrayList<>(g.hands.get(g.turn));
                keep.remove(Integer.valueOf(m.card));
                for (int c : keep) {
                    int[] cap = Game.bestCapture(rest, c);
                    if (cap.length == 0) continue;
                    List<Integer> capL = new ArrayList<>();
                    for (int x : cap) capL.add(x);
                    double gain = take(capL, c);
                    if (cap.length == rest.size()) gain += 1;
                    follow = Math.max(follow, gain);
                }
                v += 0.25 * none * follow;
            }
        }
        if (level >= 2 && g.deck.isEmpty() && m.capture.length > 0) {
            // late in the hand the last capturer collects the leftovers
            v += 0.1 * rest.size();
        }
        return v;
    }

    /** Average counting points of a card of this rank (10s: the 10 of diamonds counts 2). */
    private static double avgPoints(int rank) {
        if (rank == 10) return 1.25;
        if (rank == 2) return 0.25;
        return rank >= Card.JACK ? 1 : 0;
    }

    /** Cards this seat cannot see (other hands + deck), counted per rank 2..14. */
    private static int[] unseenByValue(Game g, int seat) {
        boolean[] seen = new boolean[52];
        for (int c : g.hands.get(seat)) seen[c] = true;
        for (int c : g.table) seen[c] = true;
        for (List<Integer> p : g.piles) for (int c : p) seen[c] = true;
        int[] out = new int[15];
        for (int c = 0; c < 52; c++) if (!seen[c]) out[Card.rank(c)]++;
        return out;
    }
}
