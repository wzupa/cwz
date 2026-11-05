package it.wzupa.cwz;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/index.html";
    private static final int EXPORT = 10;
    private WebView web;
    private String pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        int barColor = Color.rgb(16, 37, 59);
        getWindow().setStatusBarColor(barColor);
        getWindow().setNavigationBarColor(barColor);
        getWindow().getDecorView().setSystemUiVisibility(0);
        FrameLayout content = new FrameLayout(this);
        content.setBackgroundColor(barColor);
        web = new WebView(this);
        content.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(content);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.setSystemBarsAppearance(0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            // Reserve space outside the scrollable WebView, so content cannot
            // scroll over system icons or behind the on-screen keyboard.
            content.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right,
                        Math.max(bars.bottom, keyboard.bottom));
                return WindowInsets.CONSUMED;
            });
            content.requestApplyInsets();
        }
        web.addOnLayoutChangeListener((view, left, top, right, bottom,
                oldLeft, oldTop, oldRight, oldBottom) -> {
            if (bottom - top != oldBottom - oldTop || right - left != oldRight - oldLeft) {
                web.post(() -> web.evaluateJavascript(
                        "if(typeof ensureActiveCellVisible==='function'){ensureActiveCellVisible();}", null));
            }
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new ExportBridge(), "CwzAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().split("#", 2)[0].equals(HOME);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (url.split("#", 2)[0].equals(HOME)) {
                    view.evaluateJavascript("downloadData=function(name,content,type){CwzAndroid.save(name,String(content),type);}", null);
                }
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }

    private class ExportBridge {
        @JavascriptInterface public void save(String name, String content, String type) {
            runOnUiThread(() -> {
                if (pendingExport != null) return;
                if (!(name.equals("cwz-storico.json") || name.equals("cwz-risultati.csv"))) return;
                pendingExport = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(name.endsWith(".json") ? "application/json" : "text/csv");
                intent.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(intent, EXPORT); }
                catch (android.content.ActivityNotFoundException e) {
                    pendingExport = null;
                    Toast.makeText(MainActivity.this, "Nessuna app per salvare il file", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != EXPORT) return;
        String content = pendingExport;
        pendingExport = null;
        Uri uri = data == null ? null : data.getData();
        if (result != RESULT_OK || uri == null || content == null) return;
        try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new java.io.IOException("File non disponibile");
            out.write(content.getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, "File salvato", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Impossibile salvare il file", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        web.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() {
        web.evaluateJavascript("if(typeof pause==='function'){pause();}", null);
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        web.removeJavascriptInterface("CwzAndroid");
        web.destroy();
        super.onDestroy();
    }
}
