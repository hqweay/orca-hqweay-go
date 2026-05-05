import { Block, DbId } from "../orca";

export type PushMode = "default" | "delete" | "trace";

export interface MoveInfo {
  blockId: DbId;
  targetId: DbId;
  children: DbId[];
  alias: string;
}
