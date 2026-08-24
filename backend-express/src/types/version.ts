/** update_log テーブル 1 行分。DDL: no int / version text / date date / note text */
export interface UpdateLog {
  no: number;
  version: string;
  date: string;
  note: string;
}
