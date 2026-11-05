# CWZ per Android

App Android offline basata su `CWZ_v6_4.html`, mantenuto come sorgente unico
e copiato negli asset durante la compilazione. Il file HTML e il progetto Android vengono aggiornati insieme.

## Installazione sul telefono

1. Scaricare [CWZ-6.4.4-debug.apk](downloads/CWZ-6.4.4-debug.apk) sul telefono e aprirlo.
2. Se richiesto, consentire a quell'app (browser o gestore file) di installare
   applicazioni da questa origine, quindi scegliere **Installa**.
3. Aprire **CWZ**. Richiede Android 8.0 o successivo e Android System WebView aggiornato.

CWZ è un’applicazione autonoma per l’allenamento Morse offline. La versione 6.4.4 rimuove il controllo sperimentale inutilizzato e i riferimenti a confronti con altri software; mantiene le correzioni per tastiera e barre di sistema. Include la sezione Crediti con Walter IU7VNR e la versione dell’app. Usa il logo CWZ originale incluso nell'HTML come icona Android.
Si installa come aggiornamento della 6.4, senza disinstallare l'app.

Questa APK usa una firma di sviluppo: è adatta alle prove sul telefono.
Per distribuzione pubblica e aggiornamenti stabili occorre una chiave di release
conservata dal proprietario; non inserire mai chiavi o password nel repository.

## Funzioni Android

- Interfaccia e audio Morse dell'HTML, disponibili offline.
- Impostazioni e statistiche conservate nel dispositivo con `localStorage`.
- Esportazione CSV/JSON tramite il selettore Android per scegliere dove salvare.
- Riproduzione messa in pausa quando l'app passa in secondo piano.
- Nessun permesso Internet o accesso generale ai file richiesto.

I dati dell'APK sono separati da quelli del browser. Disinstallando l'app si
perdono i dati locali: esportare prima il backup JSON. L'HTML attuale non include
una funzione di importazione del backup.

## Compilazione

Servono JDK 17 o 21, Android SDK Platform 35 e Build Tools 35.0.0.
Aprire questa cartella con Android Studio, oppure impostare `JAVA_HOME` e
`ANDROID_HOME` e usare Gradle 8.9 (wrapper incluso):

```sh
./gradlew assembleDebug lintDebug
```

APK generata: `app/build/outputs/apk/debug/app-debug.apk`.
Android Studio e Gradle generano automaticamente la chiave di debug locale.
Installazione via USB con debug USB abilitato: `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

Per verificare sul telefono: generare e ascoltare un esercizio, mettere in pausa,
correggere la trascrizione, controllare le statistiche, esportare CSV/JSON e
riaprire l'app verificando la persistenza. Questi controlli su hardware Android
restano necessari prima di considerare questa versione pronta per distribuzione.
