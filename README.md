# CWZ per Android

App Android offline basata su `CWZ_v6_4.html`, mantenuto come sorgente unico
e copiato negli asset durante la compilazione. Il file HTML e il progetto Android vengono aggiornati insieme.

## Installazione sul telefono

1. Scaricare [CWZ-6.6.1-debug.apk](downloads/CWZ-6.6.1-debug.apk) sul telefono e aprirlo.
2. Se richiesto, consentire a quell'app (browser o gestore file) di installare
   applicazioni da questa origine, quindi scegliere **Installa**.
3. Aprire **CWZ**. Richiede Android 8.0 o successivo e Android System WebView aggiornato.

CWZ è un’applicazione autonoma per l’allenamento Morse. La versione 6.6.1 aggiunge l’allenamento vocale adattivo con un cursore configurabile fra selezione casuale e adattiva, mantenendo tempi medi e matrice di confusione e conserva le correzioni per tastiera e barre di sistema. Include la sezione Crediti con Walter IU7VNR e la versione dell’app. Usa il logo CWZ originale incluso nell'HTML come icona Android.
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
- Permesso microfono richiesto soltanto quando si attiva il riconoscimento vocale.

## Allenamento vocale

La pagina **Allenamento vocale** usa sempre i caratteri, la velocità e il tono
delle **Impostazioni CW**, anche dopo una modifica e una ripresa della sessione.
Ogni turno riproduce un singolo carattere, poi ascolta una parola NATO o il nome
di una cifra/simbolo. Il codice in punti e linee resta nascosto finché si preme
**Mostra codice Morse**, e torna nascosto al turno successivo.

1. Scegliere il riconoscitore e la lingua; provare prima **Prova microfono**.
2. Premere **Inizia sessione** e autorizzare il microfono, se richiesto.
3. Dopo il suono attendere **Microfono attivo**, poi pronunciare una parola NATO.
4. Controllare il testo riconosciuto, correggerlo se necessario e confermare.
   La conferma automatica è facoltativa e inizialmente disattivata.

Durante l'ascolto i comandi **Ripeti**, **Salta**, **Pausa** sono riconosciuti
separatamente dalle risposte. In pausa il microfono è spento: premere **Continua**
per riprendere. Sono sempre disponibili ripetizione e risposte da tastiera.

Nell'APK viene usato `SpeechRecognizer` Android. Dove supportato è disponibile
il riconoscitore locale dedicato (Android 12+); la presenza dei modelli della
lingua viene verificata dal servizio al momento dell'uso. Non avviene un passaggio
automatico dal servizio locale a quello remoto. Il servizio Android di sistema
può invece usare Internet e inviare audio al suo fornitore, anche se CWZ non
richiede direttamente il permesso Internet. Nessuna registrazione audio viene
salvata dall'app.

L'HTML resta un file autonomo. Nei browser compatibili usa la Web Speech API;
servono un contesto consentito dal browser, normalmente HTTPS, e il permesso
microfono. Se il riconoscimento non è disponibile, la pagina resta utilizzabile
da tastiera. Qualità, lingue e funzionamento offline dipendono dal dispositivo.

Le statistiche vocali sono separate dagli esercizi a gruppi: correttezza,
confusioni, ripetizioni, aiuti, correzioni della trascrizione e tempi medi,
anche per carattere. Il tempo è indicativo, dalla fine del primo suono al
rilevamento dell'inizio del parlato; esclude la trascrizione finale. Sono escluse
dai tempi le risposte con aiuti, ripetizioni, interruzioni, tentativi vocali
falliti, preparazione iniziale del permesso o correzioni da tastiera. Una risposta
non riconosciuta non viene automaticamente registrata come errore Morse.
Le statistiche si possono esportare in `cwz-vocale.json`.

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

## Test della pagina vocale

Con Node.js 18+ e Chromium installato:

```sh
npm ci
npm test
```

Impostare `CHROMIUM_PATH` se Chromium non è in `/usr/bin/chromium`.
I test usano eventi di riconoscimento simulati per verificare navigazione,
caratteri condivisi, comandi, aiuti, statistiche, conservazione dei dati e
fallback da tastiera. Non misurano la qualità del servizio vocale reale.
Sul telefono verificare permesso concesso/negato, lingua installata, modalità
locale/sistema, parole NATO, ripetizione, passaggio in secondo piano e assenza
di ascolto durante la riproduzione Morse.

## Selezione adattiva

Il cursore Livello adattivo va da 0% a 100%, a passi del 10%. A 0% tutti i
caratteri hanno la stessa probabilità; a 100% si usano sempre i pesi. Il valore
iniziale è 40% adattivo e 60% casuale. La scelta è salvata sul dispositivo e si
può modificare durante la sessione, con effetto dal carattere successivo.
I pesi restano tra 1× e 3×.
Servono almeno 5 tentativi validi alla stessa coppia di velocità WPM. Si usano
gli ultimi 30 tentativi per carattere, con decadimento 0,92 per ogni tentativo
precedente. Il peso combina errori (1,2), confusione più frequente (0,4) e
lentezza relativa (0,4), con crescita graduale della confidenza fino a 14 prove.
La lentezza confronta il tempo medio recente con la mediana delle medie dei
caratteri selezionati con almeno 3 tempi validi. I salti senza aiuti contano come
errori; risposte da tastiera, correzioni vocali, aiuti, ripetizioni, interruzioni
e tentativi con problemi di riconoscimento sono esclusi. I pesi si aggiornano
a ogni nuovo carattere e sono visibili nella tabella. Lo storico resta intatto.
