export function createMapLoadingState(onChange) {
  let mapReady=false;
  let firstSearchSettled=false;
  let searching=false;
  let failed=false;

  function notify() {
    const mode=failed?'hidden':!mapReady||!firstSearchSettled?'initial':searching?'refresh':'hidden';
    onChange(mode);
  }

  notify();
  return {
    mapReady(){mapReady=true;notify();},
    searchStarted(){searching=true;notify();},
    searchFinished(){firstSearchSettled=true;searching=false;notify();},
    fail(){failed=true;searching=false;notify();},
    retry(){mapReady=false;firstSearchSettled=false;searching=false;failed=false;notify();},
  };
}
