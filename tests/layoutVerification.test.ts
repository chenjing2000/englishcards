import { expect, it } from 'vitest';
import { describeLayoutMismatch, type LayoutDiagnostics } from '../src/services/layoutVerification';

const diagnostics: LayoutDiagnostics = { projectSignature: 'a'.repeat(64), pages: 1, records: [[1, '["article","p1"]', 0, 10, 0, 40, 1092, false]] };

it('distinguishes old previews, changed project data and the first measured layout difference', () => {
  expect(describeLayoutMismatch(undefined, diagnostics)).toContain('旧版');
  expect(describeLayoutMismatch({ ...diagnostics, projectSignature: 'b'.repeat(64) }, diagnostics)).toContain('项目数据不同');
  const changed = structuredClone(diagnostics); changed.records[0][5] = 41;
  const message = describeLayoutMismatch(diagnostics, changed);
  expect(message).toContain('第 1 条'); expect(message).toContain('行高');
  expect(message).toContain('40'); expect(message).toContain('41');
  expect(describeLayoutMismatch(diagnostics, { ...diagnostics, records: [] })).toContain('记录数量');
  expect(describeLayoutMismatch(diagnostics, { ...diagnostics, pages: 2 })).toContain('页数');
  expect(describeLayoutMismatch(diagnostics, diagnostics)).toContain('版本');
  expect(describeLayoutMismatch({ projectSignature: diagnostics.projectSignature, pages: 1 }, diagnostics)).toContain('请求大小限制');
});
