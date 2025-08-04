// Simple request queue to cap concurrent API calls under a limit per minute
export function createLimitedQueue(maxPerMinute = 50) {
  let queue = [];
  let executed = 0;

  const run = () => {
    while (executed < maxPerMinute && queue.length) {
      executed++;
      const fn = queue.shift();
      fn();
    }
  };

  // reset counter every 60s
  setInterval(() => {
    executed = 0;
    run();
  }, 60_000);

  return (fn) => {
    queue.push(fn);
    run();
  };
}
