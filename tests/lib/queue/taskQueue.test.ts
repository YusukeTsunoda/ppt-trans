import { taskQueue } from '@/lib/queue/taskQueue';

describe('taskQueue', () => {
  it('基本機能が動作する', () => {
    expect(taskQueue).toBeDefined();
  });
});
