/** Conveyor Teams — a group of specialists that shares access to conveyor leads. */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission } from "@/lib/iam";
import { NotFound } from "@/lib/errors";
import type { ConveyorTeam, ConveyorMemberRole, IcpCriteria } from "@/lib/sales-entities";
import type { DTO } from "@/lib/entities";
import type { User, ExecutionModel } from "@/lib/types";

const teams = repo<ConveyorTeam>("conveyorTeams");

export interface ConveyorTeamInput {
  name: string;
  model?: ExecutionModel;
  memberUserIds: string[];
  memberRoles?: ConveyorMemberRole[];
  playbookKey?: string;
  icp?: IcpCriteria;
}

export const conveyorTeamService = {
  async list(user: User): Promise<DTO<ConveyorTeam>[]> {
    return (await teams.list(user.orgId, {}, 100)).map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<ConveyorTeam>> {
    const doc = await teams.findById(user.orgId, id);
    if (!doc) throw new NotFound("conveyor team not found");
    return toDTO(doc);
  },
  /** Is this user a member of the given conveyor team? */
  async isMember(user: User, teamId: string): Promise<boolean> {
    const doc = await teams.findById(user.orgId, teamId);
    return !!doc && doc.memberUserIds.includes(user.id);
  },
  /** Which stage(s), if any, does this user own within this system (conveyor only). */
  async myStages(user: User, teamId: string): Promise<string[]> {
    const doc = await teams.findById(user.orgId, teamId);
    return doc?.memberRoles?.find((r) => r.userId === user.id)?.stageKeys ?? [];
  },
  async create(user: User, input: ConveyorTeamInput): Promise<DTO<ConveyorTeam>> {
    assertPermission(user, "sales.assign");
    const doc = await teams.insert(user.orgId, {
      name: input.name,
      model: input.model ?? "conveyor",
      memberUserIds: input.memberUserIds,
      memberRoles: input.memberRoles,
      playbookKey: input.playbookKey,
      icp: input.icp,
    });
    await audit.record({ actor: user, action: "conveyor_team.create", entity: doc._id.toHexString(), meta: { name: input.name } });
    return toDTO(doc);
  },
  async update(user: User, id: string, patch: Partial<ConveyorTeamInput>): Promise<DTO<ConveyorTeam>> {
    assertPermission(user, "sales.assign");
    const doc = await teams.update(user.orgId, id, patch as Partial<ConveyorTeam>);
    if (!doc) throw new NotFound("conveyor team not found");
    await audit.record({ actor: user, action: "conveyor_team.update", entity: id });
    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    assertPermission(user, "sales.assign");
    if (!(await teams.softDelete(user.orgId, id))) throw new NotFound("conveyor team not found");
    await audit.record({ actor: user, action: "conveyor_team.delete", entity: id });
  },
};
