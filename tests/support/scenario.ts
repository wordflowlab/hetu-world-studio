import {createHash} from "node:crypto";
import {newProject} from "../../src/domain/model.ts";
export const original="林溪在雨港邮局等信。\n她把旧钥匙放进信封。\n\n第二天，她决定出发。\n";
export const sha=(v:string|Uint8Array)=>createHash("sha256").update(v).digest("hex");
export const sourceRef={kind:"document",work_ref:{workspace_id:"workspace_test",kind:"novel",object_id:"novel_test"},document_id:"doc_11111111-1111-4111-8111-111111111111",revision_id:"rev_11111111-1111-4111-8111-111111111111",sha256:sha(original)};
export const range={source_index:0,byte_start:0,byte_end:Buffer.byteLength(original),quote:original};
export const base=(r:any,key:string)=>({object_id:r.object.object_id,expected_revision:r.object.revision,expected_sha256:r.sha256,operation_key:key});
export const selection=(r:any)=>({object_id:r.object.object_id,revision:r.object.revision});
export function wav(value=6000,frames=800,rate=8000){const b=Buffer.alloc(44+frames*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(frames*2,40);for(let n=0;n<frames;n++)b.writeInt16LE(value,44+n*2);return b;}

export function scenario(_work:any=sourceRef.work_ref):any {const p={...newProject("雨港来信"),...{
  "calendars": [
    {
      "id": "harbour",
      "title": "雨港纪年",
      "epoch_year": 1,
      "months": [
        {
          "name": "潮生月",
          "days": 30
        },
        {
          "name": "回雨月",
          "days": 28
        }
      ],
      "weekdays": [
        "潮日",
        "雾日",
        "晴日"
      ],
      "leap_every": 4,
      "leap_month": 2,
      "leap_days": 1
    }
  ],
  "markers": [
    {
      "id": "arrival",
      "title": "旧邮局来信",
      "calendar_id": "harbour",
      "date": {
        "year": 4,
        "month": 2,
        "day": 29
      },
      "ranges": []
    },
    {
      "id": "departure",
      "title": "渡口启程",
      "calendar_id": "harbour",
      "date": {
        "year": 5,
        "month": 1,
        "day": 1
      },
      "ranges": []
    }
  ],
  "rules": [
    {
      "id": "tide",
      "title": "潮汐封港",
      "premise_rule_ids": [],
      "statement": "大潮期间渡船停航，封港三日。",
      "status": "author_declared",
      "ranges": []
    },
    {
      "id": "ration",
      "title": "旧站配给",
      "premise_rule_ids": [
        "tide"
      ],
      "statement": "停航日每人领取一份口粮。",
      "status": "hypothesis",
      "ranges": []
    }
  ],
  "resources": [
    {
      "id": "grain",
      "name": "口粮",
      "unit": "份",
      "initial": 12,
      "minimum": 0
    }
  ],
  "scenarios": [
    {
      "id": "closed-port",
      "title": "封港三日的配给",
      "assumed_rule_ids": [
        "ration"
      ],
      "events": [
        {
          "id": "day-one",
          "resource_id": "grain",
          "delta": -5,
          "unit": "份",
          "reason": "第一日五人配给"
        },
        {
          "id": "day-two",
          "resource_id": "grain",
          "delta": -5,
          "unit": "份",
          "reason": "第二日五人配给"
        },
        {
          "id": "day-three",
          "resource_id": "grain",
          "delta": -5,
          "unit": "份",
          "reason": "第三日五人配给"
        }
      ]
    }
  ]
}};
for(const values of Object.values(p))if(Array.isArray(values))for(const v of values)if(v&&typeof v==="object"&&"ranges" in v)v.ranges=[range];
return p;}
