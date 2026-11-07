# CWZ, applicazione Android e HTML autonomo

La versione in sviluppo **6.7.1** usa `CWZ_v6_7_1.html` come sorgente HTML comune.
Durante la compilazione Android, Gradle copia esattamente questo file negli asset
della WebView. Il file HTML può essere pubblicato su Aruba tramite HTTPS.

## Versioni HTML

- [HTML 6.7.1](CWZ_v6_7_1.html): esercizi vocali singoli e a gruppi, timer invisibile e risposte a celle.
- [HTML 6.7.0](CWZ_v6_7_0.html): versione precedente con timer e gruppi vocali.\n- [HTML 6.6.3](CWZ_v6_6_3.html): versione vocale precedente, mantenuta senza modifiche.
- [HTML stabile 6.4.4](CWZ_stabile_v6_4_4.html): versione precedente all’introduzione della voce, con esercizi da tastiera.

Il progetto Android usa soltanto il file HTML 6.7.1. Le versioni 6.6.3 e
6.4.4 restano separate. Lo script di build e i test del repository si
riferiscono alla 6.7.1.

## Download e installazione

- [HTML 6.7.1](CWZ_v6_7_1.html), per pubblicazione su Aruba.
- [APK 6.7.1](downloads/CWZ-6.7.1-debug.apk), generata e pubblicata dalla
  [pipeline di build](.github/workflows/build-cwz-670.yml) soltanto dopo il superamento dei test.
- [APK 6.6.3 precedente](downloads/CWZ-6.6.3-debug.apk).

La 6.7.1 mantiene l'identificativo Android `it.wzupa.cwz` e una numerazione progressiva dei file, senza versioni Beta.
Per aggiornare direttamente un'installazione precedente serve però la **stessa chiave di firma**.
La firma di debug della pipeline GitHub può essere diversa da quella della APK già installata:
in tal caso Android rifiuta l'installazione come aggiornamento.
Prima di disinstallare una versione precedente, esportare le statistiche in JSON:
la disinstallazione può cancellare i dati locali. Un backup non è attualmente importabile
dalla pagina.

L'APK di debug è destinata ai test sul telefono; per una distribuzione stabile
servono una chiave di release privata e una procedura di firma coerente tra versioni.

## Funzioni Android

- Interfaccia e audio Morse dell'HTML, disponibili offline.
- Impostazioni e statistiche conservate nel dispositivo con `localStorage`.
- Esportazione CSV/JSON tramite il selettore Android per scegliere dove salvare.
- Riproduzione messa in pausa quando l'app passa in secondo piano.
- Nessun permesso Internet o accesso generale ai file richiesto.
- Permesso microfono richiesto soltanto quando si attiva il riconoscimento vocale.

## Allenamento vocale (6.7.1)\n\nLe **Impostazioni CW** sono condivise da tutti gli esercizi e non contengono\npiù un collegamento preferenziale verso i gruppi scritti. La pagina\n**Statistiche** raccoglie sia i risultati degli esercizi scritti, sia le\nstatistiche vocali complete e il riepilogo dell'ultima sessione vocale.\nI due storici rimangono separati per evitare duplicazioni e aggregazioni\nstatisticamente improprie.

La pagina **Allenamento vocale** utilizza la selezione di caratteri,
la velocità e il tono delle **Impostazioni CW**. L'estrazione dei
caratteri può essere casuale o adattiva (cursore 0–100%, predefinito 40%).

Sono disponibili tre tipi di trasmissione:
- **Carattere singolo**, come nella 6.6.3.
- **Gruppi fissi** di 2–7 caratteri (cursore).
- **Gruppi casuali** di 2–7 caratteri, selezionati per ogni gruppo.

Il parametro **Numero di ripetizioni** determina quanti esercizi vengono trasmessi:\nnei caratteri singoli, una ripetizione corrisponde a una lettera; nei gruppi,\nuna ripetizione corrisponde a un intero gruppo di lunghezza fissa o casuale.\nNon vengono creati gruppi finali troncati; le statistiche continuano a\nessere calcolate sui singoli caratteri.

Si trasmette **l'intero gruppo** in Morse prima di accendere il microfono.
Tra i caratteri si applicano le pause previste dalle Impostazioni CW, comprese\nle eventuali estensioni Farnsworth per la velocità effettiva.
La risposta è l'intera sequenza nell'alfabeto fonetico NATO, per
esempio: «Kilo India Passa Romeo Alfa».

**Passa**, **Passo** e **Vuoto** occupano esattamente una posizione vuota.
**Salta** completa il gruppo corrente con posizioni vuote.
**Ripeti** ritrasmette il gruppo dall'inizio; **Pausa** sospende l'esercizio.
La casella **Conferma automaticamente** è preselezionata. Disattivandola
si può correggere la trascrizione e confermare manualmente.

Le celle sono neutre prima del riconoscimento, mostrano contenuto
provvisorio senza valutarlo quando arriva un risultato intermedio
e diventano **verdi** per le lettere corrette o **rosse** per gli errori
e le omissioni quando la risposta viene confermata.

Il **timer di risposta** è facoltativo, regolabile e completamente
invisibile, senza conto alla rovescia. Parte quando il microfono è pronto
(al termine del suono), misura il tempo prima dell'inizio della voce e
non penalizza il tempo impiegato dal riconoscitore a elaborare la frase.
Se scade prima che inizi una risposta, le posizioni rimanenti sono omissioni.
In caso di risultato parziale e frase interrotta, CWZ accetta più segmenti
vocali per completare il gruppo e riavvia il timer per la continuazione.
Anche senza timer, il motore vocale può terminare un ascolto non produttivo,
consentendo di riprovare o rispondere da tastiera.

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

Le statistiche vocali sono separate dagli esercizi a gruppi scritti: correttezza,
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

Servono JDK 17 o 21, Android SDK Platform 35 e Build Tools 35.0.0. In CI il test browser viene eseguito prima della compilazione Android.
Aprire questa cartella con Android Studio, oppure impostare `JAVA_HOME` e
`ANDROID_HOME` e usare Gradle 8.9 (wrapper incluso):

```sh
./gradlew assembleDebug lintDebug
```

APK generata: `app/build/outputs/apk/debug/app-debug.apk` (package `it.wzupa.cwz`).\nIn GitHub Actions, dopo i test, viene pubblicata come `downloads/CWZ-6.7.1-debug.apk` e come artifact.
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

## Schermo durante l’allenamento vocale (6.6.3–6.7.1)

L’APK mantiene lo schermo acceso durante la sessione vocale e la prova microfono.
Pausa, fine sessione, uscita dalla pagina e passaggio dell’app in secondo piano
ripristinano il normale spegnimento. Il pulsante di blocco del telefono e il
passaggio ad altre app continuano a mettere in pausa l’esercizio. Non vengono
richiesti nuovi permessi né modificati i tempi di spegnimento del dispositivo.
L’HTML usa Screen Wake Lock nei browser compatibili; se non disponibile o negato,
la pagina lo segnala. La copia HTML stabile 6.4.4 resta invariata.

## Riepilogo di fine sessione (6.6.3)

A fine allenamento vocale viene mostrato un riquadro distinto dallo storico:
corrette/totale e percentuale, errori, salti, tempo medio valido, aiuti e
ripetizioni, cinque confusioni più frequenti e tre caratteri con più difficoltà.
Tutti i conteggi riguardano soltanto l’ID della sessione appena terminata.
Il riepilogo è disponibile anche per sessioni terminate prima della fine e
rimane visibile dopo la riapertura, fino al successivo riepilogo o alla
cancellazione delle statistiche vocali. Lo storico complessivo è conservato.
