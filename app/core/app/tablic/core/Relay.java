package app.tablic.core;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.Closeable;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Carries API calls over a single byte stream (a Bluetooth RFCOMM socket, or TCP in tests).
 * The guest app serves the web client from its own copy of the assets and sends only
 * "/api/..." requests through the stream; the host answers them with its WebServer, always
 * without host rights. Several calls share the stream at once (the client keeps a long-poll
 * open while sending moves), so every frame carries a request id.
 *
 * Frames (DataOutputStream encoding):
 *   hello      : UTF magic, int version                       (both directions, once)
 *   request    : int id, UTF method, UTF target, int n, n bytes
 *   response   : int id, int code, UTF type, int n, n bytes
 */
public final class Relay {

    public static final String MAGIC = "tablic-relay";
    public static final int VERSION = 1;
    private static final int MAX_FRAME = 1 << 20;

    private Relay() {}

    /** Host side: answers requests from one guest until the stream ends. Blocks. */
    public static void serve(InputStream rawIn, OutputStream rawOut, final WebServer server) throws IOException {
        final DataInputStream in = new DataInputStream(new BufferedInputStream(rawIn));
        final DataOutputStream out = new DataOutputStream(new BufferedOutputStream(rawOut));
        String magic = in.readUTF();
        int version = in.readInt();
        out.writeUTF(MAGIC);
        out.writeInt(VERSION);
        out.flush();
        if (!MAGIC.equals(magic) || version != VERSION) throw new IOException("incompatible peer");

        ExecutorService pool = Executors.newCachedThreadPool();
        try {
            while (true) {
                final int id = in.readInt();
                final String method = in.readUTF();
                final String target = in.readUTF();
                final byte[] body = readBlock(in, WebServer.MAX_BODY);
                pool.execute(new Runnable() {
                    @Override public void run() {
                        WebServer.Response r;
                        try {
                            r = target.startsWith("/api/")
                                    ? server.respond(method, target, body, false)
                                    : new WebServer.Response(404, "text/plain", new byte[0]);
                        } catch (Exception e) {
                            r = new WebServer.Response(500, "text/plain", new byte[0]);
                        }
                        try {
                            synchronized (out) {
                                out.writeInt(id);
                                out.writeInt(r.code);
                                out.writeUTF(r.type);
                                out.writeInt(r.data.length);
                                out.write(r.data);
                                out.flush();
                            }
                        } catch (IOException ignored) {
                            // the reader loop notices the broken stream
                        }
                    }
                });
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private static byte[] readBlock(DataInputStream in, int max) throws IOException {
        int n = in.readInt();
        if (n < 0 || n > max) throw new IOException("bad frame");
        byte[] b = new byte[n];
        in.readFully(b);
        return b;
    }

    /** Guest side: one open stream to the host. Thread-safe; dead after the first I/O error. */
    public static final class Client implements Closeable {
        private final Closeable socket;
        private final DataInputStream in;
        private final DataOutputStream out;
        private final Map<Integer, WebServer.Response[]> pending = new HashMap<>();
        private int nextId = 1;
        private volatile boolean closed;

        /** Performs the handshake (blocking) and starts the reader thread. */
        public Client(InputStream rawIn, OutputStream rawOut, Closeable socket) throws IOException {
            this.socket = socket;
            in = new DataInputStream(new BufferedInputStream(rawIn));
            out = new DataOutputStream(new BufferedOutputStream(rawOut));
            try {
                out.writeUTF(MAGIC);
                out.writeInt(VERSION);
                out.flush();
                String magic = in.readUTF();
                int version = in.readInt();
                if (!MAGIC.equals(magic)) throw new IOException("not a game host");
                if (version != VERSION) throw new IncompatibleException();
            } catch (IOException e) {
                close();
                throw e;
            }
            Thread t = new Thread(new Runnable() {
                @Override public void run() { readLoop(); }
            }, "relay-reader");
            t.setDaemon(true);
            t.start();
        }

        public boolean isOpen() { return !closed; }

        private void readLoop() {
            try {
                while (true) {
                    int id = in.readInt();
                    int code = in.readInt();
                    String type = in.readUTF();
                    byte[] data = readBlock(in, MAX_FRAME);
                    synchronized (pending) {
                        WebServer.Response[] slot = pending.get(id);
                        if (slot != null) {
                            slot[0] = new WebServer.Response(code, type, data);
                            pending.notifyAll();
                        }
                    }
                }
            } catch (IOException e) {
                close();
            }
        }

        /** Sends one request and waits for its answer. */
        public WebServer.Response call(String method, String target, byte[] body, long timeoutMs) throws IOException {
            if (closed) throw new IOException("closed");
            WebServer.Response[] slot = new WebServer.Response[1];
            int id;
            synchronized (pending) {
                id = nextId++;
                pending.put(id, slot);
            }
            try {
                synchronized (out) {
                    out.writeInt(id);
                    out.writeUTF(method);
                    out.writeUTF(target);
                    out.writeInt(body.length);
                    out.write(body);
                    out.flush();
                }
                long end = System.currentTimeMillis() + timeoutMs;
                synchronized (pending) {
                    while (slot[0] == null && !closed) {
                        long left = end - System.currentTimeMillis();
                        if (left <= 0) throw new IOException("timeout");
                        try {
                            pending.wait(left);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            throw new IOException("interrupted");
                        }
                    }
                    if (slot[0] == null) throw new IOException("closed");
                    return slot[0];
                }
            } catch (IOException e) {
                if (!"timeout".equals(e.getMessage())) close();
                throw e;
            } finally {
                synchronized (pending) {
                    pending.remove(id);
                }
            }
        }

        @Override public void close() {
            closed = true;
            try { socket.close(); } catch (IOException ignored) {}
            synchronized (pending) {
                pending.notifyAll();
            }
        }
    }

    /** The host runs a different app version. */
    public static final class IncompatibleException extends IOException {
        public IncompatibleException() { super("incompatible version"); }
    }

    /** Opens a new stream to the host (for example a Bluetooth socket). */
    public interface Connector {
        Client connect() throws IOException;
    }

    /**
     * Guest side Forwarder for a WebServer: sends API calls through a Client and reconnects
     * by itself (at most every few seconds) after the link drops.
     */
    public static final class Link implements WebServer.Forwarder {
        private static final long RETRY_MS = 3000;
        private final Connector connector;
        private Client client;
        private long lastAttempt;
        private volatile boolean stopped;

        public Link(Connector connector, Client first) {
            this.connector = connector;
            this.client = first;
        }

        public boolean isConnected() {
            Client c;
            synchronized (this) { c = client; }
            return c != null && c.isOpen();
        }

        private synchronized Client get() throws IOException {
            if (stopped) throw new IOException("stopped");
            if (client != null && client.isOpen()) return client;
            long now = System.currentTimeMillis();
            if (now - lastAttempt < RETRY_MS) throw new IOException("offline");
            lastAttempt = now;
            client = connector.connect();
            return client;
        }

        @Override public WebServer.Response forward(String method, String target, byte[] body) throws IOException {
            return get().call(method, target, body, WebServer.POLL_MS + 15000);
        }

        public void stop() {
            Client c;
            synchronized (this) {
                stopped = true;
                c = client;
                client = null;
            }
            if (c != null) c.close();
        }
    }
}
