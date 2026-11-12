package app.tablic.core;

/**
 * Cards are plain ints 0..51: id = suit * 13 + (rank - 2).
 * Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs.
 * Ranks 2..14, where 11 = Jack, 12 = Queen, 13 = King, 14 = Ace.
 */
public final class Card {
    public static final int SPADES = 0, HEARTS = 1, DIAMONDS = 2, CLUBS = 3;
    public static final int JACK = 11, QUEEN = 12, KING = 13, ACE = 14;
    /** "Velika desetka" (10 of diamonds, 2 points) and "mala dvojka" (2 of clubs, 1 point). */
    public static final int BIG_TEN = id(DIAMONDS, 10), LITTLE_TWO = id(CLUBS, 2);

    private Card() {}

    public static int suit(int id) { return id / 13; }
    public static int rank(int id) { return id % 13 + 2; }
    public static int id(int suit, int rank) { return suit * 13 + rank - 2; }

    public static boolean isAce(int id) { return rank(id) == ACE; }

    /** Capture value: numbers at face value, Jack 12, Queen 13, King 14, Ace 1 (or 11, see values()). */
    public static int value(int id) {
        int r = rank(id);
        if (r <= 10) return r;
        if (r == ACE) return 1;
        return r + 1;
    }

    /** All values the card may take when played: an Ace counts 1 or 11. */
    public static int[] values(int id) { return isAce(id) ? new int[]{1, 11} : new int[]{value(id)}; }

    /** Counting points: A, K, Q, J and 10 = 1, the 10 of diamonds = 2, the 2 of clubs = 1. */
    public static int points(int id) {
        if (id == BIG_TEN) return 2;
        if (id == LITTLE_TWO) return 1;
        return rank(id) >= 10 ? 1 : 0;
    }
}
