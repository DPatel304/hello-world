/* Before it was Orlis Play the app was called Astra Park, and it saved the
   family's camera choice, volume and best scores under that name. This moves
   them to their Orlis names, once, before anything reads them (main.js
   imports it first). */
export function moveOldNames(store){
  try {
    for (const k of Object.keys(store)){
      if (!k.startsWith('astrapark_')) continue;
      const to = 'orlis_' + k.slice('astrapark_'.length);
      if (store.getItem(to) === null) store.setItem(to, store.getItem(k));
      store.removeItem(k);
    }
  } catch (e){}
}
if (typeof localStorage !== 'undefined') moveOldNames(localStorage);
