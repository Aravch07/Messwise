// One read at a time. A mutation invalidates every older read.
export function createLiveSync({read,write,onState,onError=()=>{},onBusy=()=>{}}){
  let epoch=0, pending=null, controller=null, writing=false, freshUntil=0;
  function refresh(){
    if(writing||Date.now()<freshUntil)return Promise.resolve();
    if(pending)return pending;
    const generation=epoch;
    const requestController=new AbortController();controller=requestController;
    const task=(async()=>{
      try{const data=await read(requestController.signal);if(generation===epoch)onState(data);}
      catch(error){if(generation===epoch&&!requestController.signal.aborted)onError(error);}
    })();
    pending=task;
    task.finally(()=>{if(pending===task){pending=null;controller=null;}});
    return task;
  }
  async function mutate(action,body={}){
    if(writing)throw Error('Please wait for the current action to finish.');
    writing=true;onBusy(true);epoch++;controller?.abort();pending=null;controller=null;
    try{
      const data=await write(action,body);
      if(Array.isArray(data.tickets)){onState(data);freshUntil=Date.now()+500;}
      else freshUntil=0;
      return data;
    }finally{writing=false;onBusy(false);}
  }
  return {refresh,mutate};
}
