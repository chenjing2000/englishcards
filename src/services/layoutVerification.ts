import { z } from 'zod';

const record = z.tuple([z.number(), z.string(), z.number(), z.number(), z.number(), z.number(), z.number(), z.boolean()]);
const summarySchema = z.object({ projectSignature: z.string().regex(/^[a-f0-9]{64}$/), pages: z.number().int().positive() });
const diagnosticsSchema = summarySchema.extend({ records: z.array(record) });
export type LayoutRecord = z.infer<typeof record>;
export type LayoutDiagnostics = z.infer<typeof diagnosticsSchema>;

export function describeLayoutMismatch(preview: unknown, exported: LayoutDiagnostics): string {
  const parsed = summarySchema.safeParse(preview);
  if (!parsed.success) return '预览未附带诊断信息，可能因请求大小限制省略，或仍为旧版页面。请先保存 JSON，再重启服务并刷新页面后重试。';
  const summary = parsed.data;
  if (summary.projectSignature !== exported.projectSignature) return '预览与导出的项目数据不同。请先保存 JSON，再刷新页面；更新代码后请重新构建并重启服务。';
  const complete = diagnosticsSchema.safeParse(preview);
  if (!complete.success) return `项目数据一致；为遵守导出请求大小限制，未附带逐行诊断。页数：预览 ${summary.pages}，导出 ${exported.pages}。请刷新后重试；若仍失败，请保存 JSON 供进一步检查。`;
  const previous = complete.data;
  const names = ['页码', '内容标识', '起始字符', '结束字符', '纵向位置', '行高', '列宽', '缩进'];
  for (let index = 0; index < Math.min(previous.records.length, exported.records.length); index++) {
    const left = previous.records[index], right = exported.records[index];
    const field = left.findIndex((value, part) => value !== right[part]);
    if (field !== -1) return `项目数据一致；首个排版差异在第 ${index + 1} 条记录（预览第 ${left[0]} 页，导出第 ${right[0]} 页，${right[1]}）：${names[field]}，预览 ${left[field]}，导出 ${right[field]}。请刷新页面重试；若仍失败，请保留此信息以检查字体测量或版本差异。`;
  }
  if (previous.records.length !== exported.records.length) return `项目数据一致；排版记录数量不同：预览 ${previous.records.length}，导出 ${exported.records.length}。请刷新页面后重试。`;
  if (previous.pages !== exported.pages) return `项目数据一致；页数不同：预览 ${previous.pages}，导出 ${exported.pages}。请刷新页面后重试。`;
  return '项目数据与逐行排版一致，但整体校验值不同。请检查前后端版本，重新构建、重启服务并刷新页面后重试。';
}
