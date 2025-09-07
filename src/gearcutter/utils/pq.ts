export type PriorityQueueElement = [priority: number, ...rest: unknown[]];

export function pqpush<T extends PriorityQueueElement>(q: T[], val: T): void {
  let pos = q.length;
  q.push(val);
  while (pos > 0) {
    const parpos = ((pos - 1) / 2) | 0;
    if (q[parpos][0] <= q[pos][0]) {
      break;
    }
    const t = q[parpos];
    q[parpos] = q[pos];
    q[pos] = t;
    pos = parpos;
  }
}

export function pqpop<T extends PriorityQueueElement>(q: T[]): T | undefined {
  if (!q.length) {
    return undefined;
  }
  if (q.length < 2) {
    return q.shift();
  }
  const ret = q[0];
  q[0] = q.pop()!;
  let pos = 0;
  let leftpos = 1;
  while (leftpos < q.length) {
    let minpos = pos;
    if (q[minpos][0] > q[leftpos][0]) {
      minpos = leftpos;
    }
    const rightpos = leftpos + 1;
    if (rightpos < q.length && q[minpos][0] > q[rightpos][0]) {
      minpos = rightpos;
    }
    if (minpos == pos) {
      break;
    }
    const t = q[pos];
    q[pos] = q[minpos];
    q[minpos] = t;
    pos = minpos;
    leftpos = minpos * 2 + 1;
  }
  return ret;
}
