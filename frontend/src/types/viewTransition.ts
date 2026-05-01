interface Element {
  startViewTransition?: (callback: () => Promise<void> | void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
}
