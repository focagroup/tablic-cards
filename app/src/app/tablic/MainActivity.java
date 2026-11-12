package app.tablic;

import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import org.json.JSONObject;

import app.tablic.core.Relay;
import app.tablic.core.Room;
import app.tablic.core.WebServer;

/**
 * Hosts the local game server and shows the web client in a WebView.
 * The WebView may only talk to the loopback server; every other request is blocked.
 *
 * Bluetooth: the host lets paired phones join ({@link Bluetooth.Host}). A guest phone runs a
 * second, loopback-only server that serves its own copy of the web client and forwards the
 * API calls over Bluetooth ({@link Relay}); its WebView then shows that server instead.
 */
public class MainActivity extends Activity {

    private static Room room;
    private static WebServer server;
    private static int port = -1;

    private static final int GUEST_PORT = 8180;
    private static final int REQ_PERM = 1;
    private static final int REQ_ENABLE = 2;
    private static final String CONNECT_PERM = "android.permission.BLUETOOTH_CONNECT";

    private static Bluetooth.Host btHost;
    private static WebServer guestServer;
    private static Relay.Link guestLink;
    private static int guestPort = -1;
    private static String guestPeer = "";
    /** UI strings for the native dialogs, sent by the page in its current language. */
    private static JSONObject texts = new JSONObject();
    private static MainActivity current;

    private WebView web;
    private Runnable pendingBt;
    private final BroadcastReceiver btState = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            int st = i.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1);
            if (st == BluetoothAdapter.STATE_ON) autoHost();
            if (st == BluetoothAdapter.STATE_OFF || st == BluetoothAdapter.STATE_ON) notifyPage();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Phones: portrait only. Tablets (smallest width >= 600dp) may rotate freely.
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
        }

        current = this;
        startServer();

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(15, 61, 102));
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);
        ws.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new LocalOnlyClient());
        web.addJavascriptInterface(new Bridge(), "TablicApp");

        // Android 15+ draws edge-to-edge: keep the page clear of status/navigation bars.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10, 40, 71));
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    v.setPadding(b.left, b.top, b.right, b.bottom);
                    return WindowInsets.CONSUMED;
                }
            });
        }
        setContentView(root);

        IntentFilter f = new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(btState, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(btState, f);
        autoHost();

        if (guestPort > 0) {
            web.loadUrl("http://127.0.0.1:" + guestPort + "/");
        } else if (port > 0) {
            web.loadUrl("http://127.0.0.1:" + port + "/");
        } else {
            web.loadData("<h2 style='color:white;font-family:sans-serif'>Could not start the local server.</h2>",
                    "text/html", "utf-8");
        }
    }

    private WebServer.AssetSource assets() {
        final AssetManager am = getApplicationContext().getAssets();
        return new WebServer.AssetSource() {
            @Override public byte[] read(String path) {
                try {
                    InputStream in = am.open("web/" + path);
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                    in.close();
                    return out.toByteArray();
                } catch (IOException e) {
                    return null;
                }
            }
        };
    }

    private void startServer() {
        if (server != null) return;
        room = new Room();
        server = new WebServer(room, assets());
        try {
            port = server.start(8080);
        } catch (IOException e) {
            server = null;
            port = -1;
        }
    }

    /** Small bridge for the page (only local pages are ever loaded): copy text to the clipboard. */
    private final class Bridge {
        @JavascriptInterface
        public boolean copy(final String text) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Tablić", text));
                }
            });
            return true;
        }

        /** {avail, mode: host|guest, hosting, name: this phone, peer: host phone, connected} */
        @JavascriptInterface
        public String btInfo() {
            JSONObject o = new JSONObject();
            try {
                BluetoothAdapter a = adapter();
                o.put("avail", a != null);
                o.put("mode", guestPort > 0 ? "guest" : "host");
                o.put("hosting", btHost != null && btHost.isRunning());
                String name = "";
                if (a != null && hasBtPermission()) {
                    try { name = a.getName(); } catch (SecurityException ignored) {}
                }
                o.put("name", name == null ? "" : name);
                o.put("peer", guestPeer);
                o.put("connected", guestLink != null && guestLink.isConnected());
            } catch (Exception ignored) {}
            return o.toString();
        }

        @JavascriptInterface
        public void btTexts(String json) {
            try { texts = new JSONObject(json); } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void btHost(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (!on) {
                        prefs().edit().putBoolean("bt_host", false).apply();
                        if (btHost != null) btHost.stop();
                        btHost = null;
                        notifyPage();
                        return;
                    }
                    withBluetooth(new Runnable() {
                        @Override public void run() { startHosting(false); }
                    });
                }
            });
        }

        @JavascriptInterface
        public void btJoin() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    withBluetooth(new Runnable() {
                        @Override public void run() { showPicker(); }
                    });
                }
            });
        }

        @JavascriptInterface
        public void btLeave() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    leaveGuest();
                    if (port > 0) web.loadUrl("http://127.0.0.1:" + port + "/");
                }
            });
        }
    }

    // ------------------------------------------------------------------ Bluetooth

    private SharedPreferences prefs() {
        return getSharedPreferences("tablic", MODE_PRIVATE);
    }

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    private boolean hasBtPermission() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(CONNECT_PERM) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean btEnabled(BluetoothAdapter a) {
        try {
            return a != null && a.isEnabled();
        } catch (SecurityException e) {
            return false;
        }
    }

    private static String tx(String key, String fallback) {
        String v = texts.optString(key, "");
        return v.isEmpty() ? fallback : v;
    }

    private static String tx(String key, String fallback, String name) {
        return tx(key, fallback).replace("{name}", name);
    }

    private void alert(String msg) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this).setMessage(msg).setPositiveButton("OK", null).show();
    }

    /** Re-renders the parts of the page that show Bluetooth state. */
    private static void notifyPage() {
        final MainActivity a = current;
        if (a == null) return;
        a.runOnUiThread(new Runnable() {
            @Override public void run() {
                if (a.web != null) a.web.evaluateJavascript("window.btChanged && btChanged()", null);
            }
        });
    }

    /** Makes sure Bluetooth is usable (permission, switched on), then runs `next`. */
    private void withBluetooth(Runnable next) {
        BluetoothAdapter a = adapter();
        if (a == null) {
            alert(tx("btNoAdapter", "This device has no Bluetooth."));
            return;
        }
        if (!hasBtPermission()) {
            pendingBt = next;
            requestPermissions(new String[]{CONNECT_PERM}, REQ_PERM);
            return;
        }
        if (!btEnabled(a)) {
            pendingBt = next;
            try {
                startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQ_ENABLE);
            } catch (Exception e) {
                pendingBt = null;
                alert(tx("btTurnOn", "Please turn on Bluetooth."));
            }
            return;
        }
        next.run();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != REQ_PERM) return;
        Runnable next = pendingBt;
        pendingBt = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            if (next != null) withBluetooth(next);
            notifyPage();
        } else if (!isFinishing()) {
            new AlertDialog.Builder(this)
                    .setMessage(tx("btNoPerm", "Bluetooth needs the \u201cNearby devices\u201d permission."))
                    .setPositiveButton("OK", null)
                    .setNeutralButton(tx("btAppSettings", "App settings"), new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface d, int w) {
                            try {
                                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                        Uri.parse("package:" + getPackageName())));
                            } catch (Exception ignored) {}
                        }
                    })
                    .show();
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code != REQ_ENABLE) return;
        Runnable next = pendingBt;
        pendingBt = null;
        if (next != null && btEnabled(adapter())) next.run();
    }

    /** Resumes hosting after a restart or after Bluetooth was switched back on. */
    private void autoHost() {
        if (prefs().getBoolean("bt_host", false) && hasBtPermission() && btEnabled(adapter())) startHosting(true);
    }

    private void startHosting(boolean quiet) {
        if (btHost != null && btHost.isRunning()) { notifyPage(); return; }
        if (server == null) return;
        try {
            btHost = new Bluetooth.Host(adapter(), server, new Runnable() {
                @Override public void run() { notifyPage(); }
            });
            prefs().edit().putBoolean("bt_host", true).apply();
        } catch (IOException | SecurityException e) {
            btHost = null;
            if (!quiet) alert(tx("btHostFailed", "Could not start Bluetooth."));
        }
        notifyPage();
    }

    private static boolean looksLikePhone(BluetoothDevice d) {
        BluetoothClass c;
        try { c = d.getBluetoothClass(); } catch (SecurityException e) { return true; }
        if (c == null) return true;
        switch (c.getMajorDeviceClass()) {
            case BluetoothClass.Device.Major.AUDIO_VIDEO:
            case BluetoothClass.Device.Major.PERIPHERAL:
            case BluetoothClass.Device.Major.IMAGING:
            case BluetoothClass.Device.Major.WEARABLE:
            case BluetoothClass.Device.Major.HEALTH:
            case BluetoothClass.Device.Major.TOY:
                return false;
            default:
                return true;
        }
    }

    private static String nameOf(BluetoothDevice d) {
        String n = null;
        try { n = d.getName(); } catch (SecurityException ignored) {}
        return n == null || n.isEmpty() ? d.getAddress() : n;
    }

    /** Lists paired phones; the last one joined comes first. */
    private void showPicker() {
        final BluetoothAdapter a = adapter();
        final List<BluetoothDevice> devices = new ArrayList<>();
        try {
            for (BluetoothDevice d : a.getBondedDevices()) if (looksLikePhone(d)) devices.add(d);
        } catch (SecurityException ignored) {}
        final String last = prefs().getString("bt_last", "");
        Collections.sort(devices, new Comparator<BluetoothDevice>() {
            @Override public int compare(BluetoothDevice x, BluetoothDevice y) {
                boolean lx = x.getAddress().equals(last), ly = y.getAddress().equals(last);
                if (lx != ly) return lx ? -1 : 1;
                return nameOf(x).compareToIgnoreCase(nameOf(y));
            }
        });
        final String[] names = new String[devices.size()];
        for (int i = 0; i < names.length; i++) names[i] = nameOf(devices.get(i));

        AlertDialog.Builder b = new AlertDialog.Builder(this).setTitle(tx("btPick", "Join which phone?"));
        if (devices.isEmpty()) {
            b.setMessage(tx("btNone", "No paired phones yet. Pair the two phones once in the Bluetooth settings, then try again."));
        } else {
            b.setItems(names, new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    connectTo(a, devices.get(w).getAddress(), names[w]);
                }
            });
        }
        b.setNeutralButton(tx("btPair", "Bluetooth settings"), new DialogInterface.OnClickListener() {
            @Override public void onClick(DialogInterface d, int w) {
                try { startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); } catch (Exception ignored) {}
            }
        });
        b.setNegativeButton(tx("cancel", "Cancel"), null);
        b.show();
    }

    private void connectTo(final BluetoothAdapter a, final String address, final String name) {
        final boolean[] cancelled = {false};
        final AlertDialog dlg = new AlertDialog.Builder(this)
                .setMessage(tx("btConnecting", "Connecting to {name}\u2026", name))
                .setCancelable(false)
                .setNegativeButton(tx("cancel", "Cancel"), new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) { cancelled[0] = true; }
                })
                .show();
        final Relay.Connector connector = Bluetooth.connector(a, address);
        Thread t = new Thread(new Runnable() {
            @Override public void run() {
                Relay.Client client = null;
                IOException err = null;
                try {
                    client = connector.connect();
                } catch (IOException e) {
                    err = e;
                }
                final Relay.Client c = client;
                final IOException e = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (dlg.isShowing()) dlg.dismiss();
                        if (cancelled[0] || isFinishing()) {
                            if (c != null) c.close();
                            return;
                        }
                        if (c == null) {
                            alert(e instanceof Relay.IncompatibleException
                                    ? tx("btVersion", "The other phone has a different version of the app. Install the same version on both phones.")
                                    : tx("btFailed", "Could not connect to {name}. Is the game open there, with Bluetooth players allowed?", name));
                            return;
                        }
                        prefs().edit().putString("bt_last", address).apply();
                        startGuest(connector, c, name);
                    }
                });
            }
        }, "bt-connect");
        t.setDaemon(true);
        t.start();
    }

    private void startGuest(Relay.Connector connector, Relay.Client client, String name) {
        leaveGuest();
        Relay.Link link = new Relay.Link(connector, client);
        WebServer g = new WebServer(null, assets());
        g.setForwarder(link);
        try {
            guestPort = g.start(GUEST_PORT, true);
        } catch (IOException e) {
            link.stop();
            alert(tx("btHostFailed", "Could not start Bluetooth."));
            return;
        }
        guestServer = g;
        guestLink = link;
        guestPeer = name;
        web.loadUrl("http://127.0.0.1:" + guestPort + "/");
    }

    private static void leaveGuest() {
        if (guestLink != null) guestLink.stop();
        if (guestServer != null) guestServer.stop();
        guestLink = null;
        guestServer = null;
        guestPort = -1;
        guestPeer = "";
    }

    private static boolean isLocal(Uri u) {
        if (u == null) return false;
        String scheme = u.getScheme();
        if ("data".equals(scheme) || "about".equals(scheme)) return true;
        if (!"http".equals(scheme) || !"127.0.0.1".equals(u.getHost())) return false;
        return u.getPort() == port || (guestPort > 0 && u.getPort() == guestPort);
    }

    private static final class LocalOnlyClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isLocal(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !isLocal(Uri.parse(url));
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (isLocal(request.getUrl())) return null;
            return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        }
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this)
                .setMessage("Izaći? / Изаћи? / Выйти? / Exit? / Beenden?")
                .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) {
                        leaveGuest();
                        if (btHost != null) btHost.stop();
                        btHost = null;
                        if (server != null) server.stop();
                        server = null;
                        room = null;
                        port = -1;
                        finish();
                    }
                })
                .setNegativeButton("✕", null)
                .show();
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(btState); } catch (Exception ignored) {}
        if (current == this) current = null;
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
