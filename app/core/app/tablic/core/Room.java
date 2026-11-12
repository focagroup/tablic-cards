package app.tablic.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import app.cards.core.GameInfo;

/**
 * The Tablić room: lobby settings, the running {@link Game} and its view for the web client.
 * Seats, joining, long polling and the bot loop come from the framework's Room.
 */
public final class Room extends app.cards.core.Room {
    public static final GameInfo INFO = new GameInfo("tablic", "Tablic", "Tablić");
    private static final int SEATS = 4;
    private static final long BOT_DELAY_MS = 1200;

    private final Game.Config cfg = new Game.Config();
    private Game game;

    public Room() {
        super(INFO, SEATS, BOT_DELAY_MS);
    }

    // ------------------------------------------------------------------ lifecycle

    @Override protected boolean hasGame() { return game != null; }

    @Override protected int players() { return cfg.players; }

    @Override protected void configureGame(Map<String, String> p) {
        if (p.containsKey("players")) cfg.players = clamp(parseInt(p.get("players"), 2), 2, 4);
        if (p.containsKey("teams")) cfg.teams = "1".equals(p.get("teams")) || "true".equals(p.get("teams"));
        if (p.containsKey("length")) cfg.longGame = "long".equals(p.get("length"));
    }

    @Override protected void newGame() { game = new Game(cfg, rng); }

    @Override protected void nextGameRound() { game.nextRound(); }

    @Override protected void clearGame() { game = null; }

    // ------------------------------------------------------------------ moves and bots

    @Override public boolean handles(String action) { return "play".equals(action); }

    /** "play": card=&lt;id&gt; and capture=&lt;id,id,...&gt; (the table cards taken). */
    @Override protected String play(int seat, String action, Map<String, String> p) {
        return game.play(seat, parseInt(p.get("card"), -1), parseInts(p.get("capture")));
    }

    @Override protected int botTurn() {
        return game.phase == Game.Phase.PLAYING ? game.turn : -1;
    }

    @Override protected void botPlay(int s, int level) {
        Bot.Choice c = Bot.choose(game, s, level, rng);
        game.play(s, c.card, c.capture);
    }

    // ------------------------------------------------------------------ state view

    @Override protected Object configView() {
        Map<String, Object> c = new LinkedHashMap<>();
        Game.Config gc = game != null ? game.cfg : cfg;
        c.put("players", gc.players);
        c.put("teams", gc.players == 4 && gc.teams);
        c.put("length", gc.longGame ? "long" : "short");
        c.put("target", Game.LONG_TARGET);
        return c;
    }

    @Override protected String phase() {
        Game g = game;
        return g.phase == Game.Phase.PLAYING ? "playing" : g.phase == Game.Phase.ROUND_END ? "roundEnd" : "gameOver";
    }

    @Override protected Map<String, Object> gameView(List<Integer> mine) {
        Game g = game;
        Map<String, Object> gm = new LinkedHashMap<>();
        gm.put("round", g.round);
        gm.put("dealer", g.dealer);
        gm.put("turn", g.turn);
        gm.put("deck", g.deck.size());
        gm.put("dealSeq", g.dealSeq);
        gm.put("table", Game.toArray(g.table));
        List<Object> counts = new ArrayList<>();
        for (List<Integer> h : g.hands) counts.add(h.size());
        gm.put("handCounts", counts);
        Map<String, Object> hands = new LinkedHashMap<>();
        for (Object si : mine) hands.put(String.valueOf(si), Game.toArray(g.hands.get((Integer) si)));
        gm.put("hands", hands);
        // Captured cards are private: only the piles of the requester's own team(s) are sent.
        Map<String, Object> myPiles = new LinkedHashMap<>();
        for (Object si : mine) {
            int tm = g.team((Integer) si);
            myPiles.put(String.valueOf(tm), Game.toArray(g.piles.get(tm)));
        }
        gm.put("myPiles", myPiles);
        List<Object> piles = new ArrayList<>();
        for (List<Integer> p : g.piles) piles.add(p.size());
        gm.put("piles", piles);
        gm.put("tablas", g.tablas);
        gm.put("totals", g.totals);
        gm.put("winner", g.winner);
        gm.put("lastCapturer", g.lastCapturer);

        if (g.phase == Game.Phase.PLAYING && mine.contains(g.turn)) {
            // Per hand card: the capture groups (one list per card value; Ace = 1 or 11) and the best capture.
            Map<String, Object> opts = new LinkedHashMap<>();
            for (int card : g.hands.get(g.turn)) {
                Map<String, Object> oc = new LinkedHashMap<>();
                List<Object> byValue = new ArrayList<>();
                for (List<int[]> gs : g.captureGroups(card)) byValue.add(new ArrayList<Object>(gs));
                oc.put("groups", byValue);
                oc.put("best", Game.bestCapture(g.table, card));
                opts.put(String.valueOf(card), oc);
            }
            gm.put("options", opts);
        }

        if (g.lastMove != null) {
            Game.Move mv = g.lastMove;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("seq", mv.seq);
            m.put("seat", mv.seat);
            m.put("card", mv.card);
            m.put("capture", mv.capture);
            m.put("tabla", mv.tabla);
            m.put("sweep", mv.sweep);
            m.put("sweepTeam", mv.sweepTeam);
            gm.put("lastMove", m);
        }

        if (g.lastResult != null && g.phase != Game.Phase.PLAYING) {
            List<Object> res = new ArrayList<>();
            for (Game.TeamResult r : g.lastResult) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("cards", r.cards);
                m.put("ptMostCards", r.ptMostCards);
                m.put("honours", r.honours);
                m.put("tens", r.tens);
                m.put("bigTen", r.bigTen);
                m.put("littleTwo", r.littleTwo);
                m.put("tablas", r.tablas);
                m.put("total", r.total);
                res.add(m);
            }
            gm.put("result", res);
        }
        List<Object> hist = new ArrayList<>();
        for (int[] h : g.history) hist.add(h);
        gm.put("history", hist);
        return gm;
    }
}
