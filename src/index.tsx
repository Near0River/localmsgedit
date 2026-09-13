/**
 * Local Message Edit — plugin per Revenge (Discord Android)
 *
 * Idea: mantiene una Map<messageId, nuovoContenuto> in memoria.
 * - Patcha MessageStore.getMessage così che, se un messaggio ha un edit
 *   locale salvato, venga restituito con il contenuto modificato.
 * - Aggiunge una voce "Modifica (locale)" al menu contestuale di OGNI
 *   messaggio (non solo i tuoi), che apre un piccolo prompt di testo.
 *
 * ATTENZIONE IMPORTANTE:
 * I nomi esatti dei moduli interni di Discord (findByProps/findByName) e
 * i package "@vendetta/..." o "@revenge-mod/..." cambiano tra versioni di
 * Revenge, perché Discord offusca e aggiorna il bundle react-native di
 * continuo. Questo codice è uno scheletro funzionante nella LOGICA, ma
 * probabilmente dovrai:
 *   1. Verificare i path di import corretti per la tua build di Revenge
 *      (guarda i typings in github.com/revenge-mod o plugin di esempio
 *      come PalmDevs/revenge-next-plugins).
 *   2. Usare il "Debugger" di Revenge (Settings > Developer) per trovare
 *      il modulo giusto se findByProps non trova nulla.
 */

import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Mappa in memoria: messageId -> contenuto modificato localmente
const localEdits = new Map<string, string>();
const unpatches: Array<() => void> = [];

export function onLoad() {
  const MessageStore = findByProps("getMessage", "getMessages");
  const FluxDispatcher = findByProps("dispatch", "subscribe");

  // 1. Intercetta la lettura dei messaggi: se esiste un edit locale,
  //    sovrascrive il contenuto prima che arrivi ai componenti React.
  unpatches.push(
    after("getMessage", MessageStore, (args, message) => {
      if (!message) return message;
      const edit = localEdits.get(message.id);
      if (edit === undefined) return message;
      return {
        ...message,
        content: edit,
        // così Discord mostra il badge "(modificato)" come se fosse reale
        edited_timestamp: message.edited_timestamp ?? new Date().toISOString(),
      };
    })
  );

  // 2. Voce nel menu contestuale dei messaggi.
  //    NB: il nome del modulo del context menu varia molto tra versioni;
  //    qui uso un pattern comune (registrazione di "MessageLongPressContextMenu").
  const ContextMenu = findByProps("MessageLongPressContextMenu");
  if (ContextMenu?.MessageLongPressContextMenu) {
    unpatches.push(
      after("default", ContextMenu, ([{ message }], result) => {
        if (!result?.props?.children) return result;
        result.props.children.push({
          label: "Modifica (locale)",
          onPress: () => promptLocalEdit(message, FluxDispatcher),
        });
        return result;
      })
    );
  } else {
    showToast(
      "LocalMessageEdit: menu contestuale non trovato, adatta il selettore del modulo"
    );
  }
}

function promptLocalEdit(message: any, FluxDispatcher: any) {
  // Qui dovresti aprire una vera modale con TextInput (React Native).
  // Per semplicità di esempio, uso window.prompt-like logic:
  // sostituiscilo con un componente ActionSheet/Modal di Revenge.
  const nuovoTesto = globalThis.prompt?.(
    "Nuovo contenuto locale:",
    message.content
  );
  if (nuovoTesto == null) return;

  localEdits.set(message.id, nuovoTesto);

  // Forza il refresh della UI ridispacciando l'evento di update messaggio
  FluxDispatcher.dispatch({
    type: "MESSAGE_UPDATE",
    message: { ...message, content: nuovoTesto },
  });

  showToast("Messaggio modificato solo localmente");
}

export function onUnload() {
  unpatches.forEach((unpatch) => unpatch());
  unpatches.length = 0;
  localEdits.clear();
}
