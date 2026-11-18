import { createHash } from "node:crypto";
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export async function importText(c: any, originals: string[]) {
  const volume = {
    volume_id: "volume_11111111-1111-4111-8111-111111111111",
    title: "雨港旧事",
  };
  let start = 0;
  const units = originals.map((content, index) => {
    const end = start + [...content].length,
      unit = {
        index,
        start,
        end,
        title: "第" + (index + 1) + "章 来信",
        volume_id: volume.volume_id,
        content_sha256: sha(content),
      };
    start = end;
    return unit;
  });
  const current = () =>
    c.ok("hetu_get_novel", { management_ref: c.management });
  const expected = async () => {
    const n = await current();
    return { revision: n.revision, sha256: n.sha256 };
  };
  const reg = await c.ok("hetu_register_import_authorization", {
    management_ref: c.management,
    work_ref: c.work,
    expected: await expected(),
    plan: {
      source_name: "雨港来信.txt",
      source_sha256: sha(originals.join("")),
      reading_sha256: sha(originals.join("")),
      reading_characters: start,
      language_tag: "zh-CN",
      volumes: [volume],
      units,
    },
    authorization_note:
      "当前Codex会话授权隔离小说测试导入，保留全部原稿；不采纳候选或定稿。",
    operation_key: "register-original",
  });
  const prepare = async (action: string, input: any, key: string) =>
    c.ok("hetu_prepare_management_operation", {
      management_ref: c.management,
      action: "hetu." + action,
      input,
      summary: "隔离固定原稿导入",
      operation_key: "prepare-" + key,
    });
  const execute = async (p: any, key: string) =>
    c.ok("hetu_execute_management_operation", {
      management_ref: c.management,
      proposal_id: p.proposal_id,
      proposal_sha256: p.proposal_sha256,
      import_authorization_ref: reg.import_authorization_ref,
      operation_key: "execute-" + key,
    });
  await execute(
    await prepare(
      "novels.save_structure",
      {
        expected: await expected(),
        volumes: [volume],
        chapters: [],
        operation_key: "structure",
      },
      "structure",
    ),
    "structure",
  );
  const result = await execute(
    await prepare(
      "documents.import_batch",
      {
        expected: await expected(),
        items: units.map((u, index) => ({
          title: u.title,
          language_tag: "zh-CN",
          volume_id: volume.volume_id,
          source: {
            inline_source: {
              filename: index + ".txt",
              base64: Buffer.from(originals[index]).toString("base64"),
              sha256: sha(originals[index]),
            },
            format: "txt",
            profile: "source/1",
          },
        })),
        acknowledgement: "原稿导入，不采纳不定稿。",
        operation_key: "import-original",
      },
      "import-original",
    ),
    "import-original",
  );
  return result.result.documents.map((d: any, index: number) => ({
    kind: "document",
    work_ref: c.work,
    document_id: d.document.document_id,
    revision_id: d.revision.revision_id,
    sha256: d.revision.sha256,
  }));
}
