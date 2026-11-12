package app.tablic.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * A single game room: lobby configuration, seats, the running game and the bot driver.
 * All public methods are synchronized; state changes bump `version` and wake long-polls.
 */
public final class Room {
    public static final int LOCAL = 0, REMOTE = 1, BOT = 2;
    private static final String[] TYPE_NAMES = {"local", "remote", "bot"};
    private static final long BOT_DELAY_MS = 1200;
    private static final long ONLINE_MS = 45000;

    public static final class Seat {
        int type;
        String name = "";
        String token;      // remote seats: owning client token
        int botLevel = 1;
        long lastSeen;
    }

    private final Random rng = new Random();
    private final Game.Config cfg = new Game.Config();
    private final Seat[] seats = new Seat[4];
    private Game game;
    private long version = 1;
    private long lastChange = System.currentTimeMillis();
    private int gameId = 0;

    public Room() {
        for (int i = 0; i < 4; i++) {
            seats[i] = new Seat();
            seats[i].type = i == 0 ? LOCAL : BOT;
        }
        Thread t = new Thread(new Runnable() {
            @Override public void run() { botLoop(); }
        }, "tablic-bots");
        t.setDaemon(true);
        t.start();
    }

    private void changed() {
        version++;
        lastChange = System.currentTimeMillis();
        notifyAll();
    }

    // ------------------------------------------------------------------ long poll

    public synchronized void awaitChange(long since, long timeoutMs) {
        long end = System.currentTimeMillis() + timeoutMs;
        while (version <= since) {
            long left = end - System.currentTimeMillis();
            if (left <= 0) return;
            try { wait(left); } catch (InterruptedException e) { return; }
        }
    }

    // ------------------------------------------------------------------ bots

    private void botLoop() {
        while (true) {
            synchronized (this) {
                try {
                    if (game != null && game.phase == Game.Phase.PLAYING && seats[game.turn].type == BOT) {
                        long due = lastChange + BOT_DELAY_MS;
                        long now = System.currentTimeMillis();
                        if (now >= due) {
                            int s = game.turn;
                            Bot.Choice c = Bot.choose(game, s, seats[s].botLevel, rng);
                            game.play(s, c.card, c.capture);
                            changed();
                        } else {
                            wait(due - now);
                        }
                    } else {
                        wait(5000);
                    }
                } catch (InterruptedException e) {
                    return;
                } catch (RuntimeException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    // ------------------------------------------------------------------ access control

    private boolean controls(int seat, String token, boolean isHost) {
        if (seat < 0 || seat >= cfg.players) return false;
        Seat s = seats[seat];
        if (s.type == LOCAL) return isHost;
        if (s.type == REMOTE) return token != null && token.equals(s.token);
        return false;
    }

    private void touch(String token) {
        if (token == null) return;
        long now = System.currentTimeMillis();
        for (Seat s : seats) {
            if (s.type == REMOTE && token.equals(s.token)) {
                boolean wasOffline = now - s.lastSeen > ONLINE_MS;
                s.lastSeen = now;
                if (wasOffline) changed();
            }
        }
    }

    // ------------------------------------------------------------------ lobby actions

    public synchronized String configure(boolean isHost, Map<String, String> p) {
        if (!isHost) return "host_only";
        if (game != null) return "game_running";
        if (p.containsKey("players")) cfg.players = clamp(parseInt(p.get("players"), 2), 2, 4);
        if (p.containsKey("teams")) cfg.teams = "1".equals(p.get("teams")) || "true".equals(p.get("teams"));
        if (p.containsKey("length")) cfg.longGame = "long".equals(p.get("length"));
        for (int i = 0; i < 4; i++) {
            Seat s = seats[i];
            String type = p.get("seat" + i + "_type");
            if (type != null) {
                int nt = indexOf(TYPE_NAMES, type);
                if (nt >= 0 && nt != s.type) {
                    s.type = nt;
                    s.token = null;
                    s.name = "";
                }
            }
            String name = p.get("seat" + i + "_name");
            if (name != null && s.type != REMOTE) s.name = cleanName(name);
            String lvl = p.get("seat" + i + "_bot");
            if (lvl != null) s.botLevel = clamp(parseInt(lvl, 1), 0, 2);
        }
        changed();
        return null;
    }

    public synchronized String join(String token, int seat, String name) {
        if (token == null || token.length() < 8) return "bad_token";
        if (game != null) return "game_running";
        if (seat < 0 || seat >= cfg.players) return "bad_seat";
        Seat s = seats[seat];
        if (s.type != REMOTE) return "bad_seat";
        if (s.token != null && !s.token.equals(token)) return "seat_taken";
        for (Seat o : seats) if (o != s && token.equals(o.token)) { o.token = null; o.name = ""; }
        s.token = token;
        s.name = cleanName(name);
        s.lastSeen = System.currentTimeMillis();
        changed();
        return null;
    }

    public synchronized String leave(String token) {
        if (token == null) return null;
        for (Seat s : seats) {
            if (token.equals(s.token) && game == null) { s.token = null; s.name = ""; }
        }
        changed();
        return null;
    }

    public synchronized String start(boolean isHost) {
        if (!isHost) return "host_only";
        if (game != null) return "game_running";
        for (int i = 0; i < cfg.players; i++)
            if (seats[i].type == REMOTE && seats[i].token == null) return "seats_open";
        game = new Game(cfg, rng);
        gameId++;
        changed();
        return null;
    }

    public synchronized String nextRound(boolean isHost) {
        if (!isHost) return "host_only";
        if (game == null) return "no_game";
        game.nextRound();
        changed();
        return null;
    }

    public synchronized String endGame(boolean isHost) {
        if (!isHost) return "host_only";
        game = null;
        changed();
        return null;
    }

    /** Mid-game: hand a seat (e.g. a disconnected remote player) to a bot, or back to the host. */
    public synchronized String setSeatType(boolean isHost, int seat, String type) {
        if (!isHost) return "host_only";
        if (seat < 0 || seat >= cfg.players) return "bad_seat";
        int nt = indexOf(TYPE_NAMES, type);
        if (nt < 0 || nt == REMOTE) return "bad_type";
        seats[seat].type = nt;
        seats[seat].token = null;
        changed();
        return null;
    }

    public synchronized String play(String token, boolean isHost, int seat, int card, int[] capture) {
        if (game == null) return "no_game";
        if (!controls(seat, token, isHost)) return "not_your_seat";
        String err = game.play(seat, card, capture);
        if (err == null) changed();
        return err;
    }

    // ------------------------------------------------------------------ state view

    public synchronized String state(String token, boolean isHost, List<String> addresses, int port) {
        touch(token);
        long now = System.currentTimeMillis();
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("v", version);
        o.put("isHost", isHost);
        o.put("gameId", gameId);

        List<Object> mine = new ArrayList<>();
        for (int i = 0; i < cfg.players; i++) if (controls(i, token, isHost)) mine.add(i);
        o.put("mySeats", mine);

        Map<String, Object> c = new LinkedHashMap<>();
        Game.Config gc = game != null ? game.cfg : cfg;
        c.put("players", gc.players);
        c.put("teams", gc.players == 4 && gc.teams);
        c.put("length", gc.longGame ? "long" : "short");
        c.put("target", Game.LONG_TARGET);
        o.put("config", c);

        List<Object> seatList = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Seat s = seats[i];
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", TYPE_NAMES[s.type]);
            m.put("name", s.name);
            m.put("bot", s.botLevel);
            m.put("taken", s.type != REMOTE || s.token != null);
            m.put("online", s.type != REMOTE || (s.token != null && now - s.lastSeen < ONLINE_MS));
            m.put("you", token != null && token.equals(s.token));
            seatList.add(m);
        }
        o.put("seats", seatList);

        if (isHost) {
            o.put("addresses", addresses);
            o.put("port", port);
        }

        if (game == null) {
            o.put("phase", "lobby");
            return Json.write(o);
        }
        Game g = game;
        o.put("phase", g.phase == Game.Phase.PLAYING ? "playing" : g.phase == Game.Phase.ROUND_END ? "roundEnd" : "gameOver");
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
        o.put("game", gm);
        return Json.write(o);
    }

    // ------------------------------------------------------------------ helpers

    private static String cleanName(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length() && b.length() < 16; i++) {
            char ch = s.charAt(i);
            if (ch >= 0x20 && ch != '<' && ch != '>') b.append(ch);
        }
        return b.toString().trim();
    }

    private static int indexOf(String[] a, String s) {
        for (int i = 0; i < a.length; i++) if (a[i].equals(s)) return i;
        return -1;
    }

    static int parseInt(String s, int def) {
        try { return Integer.parseInt(s.trim()); } catch (Exception e) { return def; }
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
}
