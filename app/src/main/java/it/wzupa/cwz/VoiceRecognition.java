package it.wzupa.cwz;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

/** One recognition request at a time. All recognizer operations run on the UI thread. */
final class VoiceRecognition {
    private static final int PERMISSION = 21;
    private final Activity activity;
    private final Consumer<String> callback;
    private final boolean systemAvailable;
    private final boolean localAvailable;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private int active = -1;
    private String mode, language;
    private long requestedAt;
    private boolean waitingPermission;

    VoiceRecognition(Activity activity, Consumer<String> callback) {
        this.activity = activity;
        this.callback = callback;
        systemAvailable = SpeechRecognizer.isRecognitionAvailable(activity);
        localAvailable = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity);
    }

    String info() {
        return "{\"available\":" + (systemAvailable || localAvailable)
                + ",\"local\":" + localAvailable + ",\"system\":" + systemAvailable + "}";
    }

    void start(int id, String selectedMode, String selectedLanguage) {
        cancel();
        active = id;
        mode = selectedMode;
        language = "en-US".equals(selectedLanguage) ? "en-US" : "it-IT";
        requestedAt = SystemClock.elapsedRealtime();
        if (!("local".equals(mode) ? localAvailable : systemAvailable)) {
            fail(id, "Riconoscitore selezionato non disponibile. Usa la risposta da tastiera.");
            return;
        }
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            waitingPermission = true;
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION);
            return;
        }
        listen(id);
    }

    void onPermissionResult(int request, int[] results) {
        if (request != PERMISSION || !waitingPermission) return;
        waitingPermission = false;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) listen(active);
        else fail(active, "Microfono non autorizzato. Puoi abilitarlo nelle impostazioni Android o rispondere da tastiera.");
    }

    private void listen(int id) {
        try {
            recognizer = "local".equals(mode) && Build.VERSION.SDK_INT >= 31
                    ? SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
                    : SpeechRecognizer.createSpeechRecognizer(activity);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { emit(id, "ready", null, null); }
                @Override public void onBeginningOfSpeech() { emit(id, "speech", null, null); }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    emit(id, "result", null, texts);
                    release(id);
                }
                @Override public void onError(int code) { fail(id, errorMessage(code)); }
                @Override public void onEndOfSpeech() { emit(id, "processing", null, null); }
                @Override public void onRmsChanged(float rms) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onPartialResults(Bundle results) {}
                @Override public void onEvent(int type, Bundle params) {}
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            // Local mode uses the dedicated on-device API; never silently falls back to a network service.
            recognizer.startListening(intent);
            handler.postDelayed(() -> { if (active == id) fail(id, "Ascolto terminato. Tocca Rispondi a voce per riprovare."); }, 20000);
        } catch (Exception e) {
            fail(id, "Impossibile avviare il riconoscimento. Controlla il servizio vocale e la lingua installata.");
        }
    }

    private void emit(int id, String type, String message, ArrayList<String> texts) {
        if (active != id) return;
        try {
            JSONObject event = new JSONObject();
            event.put("id", id);
            event.put("type", type);
            event.put("delayMs", SystemClock.elapsedRealtime() - requestedAt);
            if (message != null) event.put("message", message);
            if (texts != null) event.put("alternatives", new JSONArray(texts));
            callback.accept(event.toString());
        } catch (org.json.JSONException ignored) { }
    }

    private void fail(int id, String message) { emit(id, "error", message, null); release(id); }
    private void release(int id) { if (active == id) cancel(); }
    void cancel() {
        active = -1;
        waitingPermission = false;
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) {
            recognizer.cancel();
            recognizer.destroy();
            recognizer = null;
        }
    }

    private static String errorMessage(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Microfono non autorizzato.";
            case SpeechRecognizer.ERROR_NO_MATCH: return "Parola non riconosciuta: riprova. Nessun errore Morse conteggiato.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "Nessuna voce rilevata. Riprova quando sei pronto.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Servizio vocale senza connessione. Prova la modalità locale, se disponibile.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Microfono occupato. Attendi e riprova.";
            case 12:
            case 13: return "Lingua non supportata o modello vocale non installato. Prova un’altra lingua o controlla i servizi vocali Android.";
            default: return "Riconoscimento interrotto (" + code + "). Puoi riprovare o usare la tastiera.";
        }
    }
}
