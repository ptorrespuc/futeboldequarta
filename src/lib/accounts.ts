import { supabase } from "@/src/lib/supabase";
import type {
  AccountPlayer,
  AccountPlayerPositionPreference,
  AccountRole,
  AccountMembership,
  AccountPriorityGroup,
  AccountSchedule,
  Event,
  EventParticipant,
  EventPoll,
  EventPollOption,
  EventPollVote,
  ModalityPosition,
  PollTemplate,
  Profile,
  SportModality,
  SportsAccount,
} from "@/src/types/domain";

export type AccountOverview = {
  account: SportsAccount;
  modality: SportModality;
  schedules: AccountSchedule[];
  priorityGroups: AccountPriorityGroup[];
  activeMemberCount: number;
  activePlayerCount: number;
  activePollTemplateCount: number;
};

export type RosterMember = {
  membership: AccountMembership;
  profile: Profile;
  priorityGroup: AccountPriorityGroup | null;
  preferredPositions: ModalityPosition[];
};

export type AccountMembershipAdminItem = {
  membership: AccountMembership;
  account: SportsAccount;
  profile: Profile;
  priorityGroup: AccountPriorityGroup | null;
};

export type ProvisionedAuthProfile = {
  profileId: string;
  email: string;
  fullName: string;
  invited: boolean;
  alreadyExisted: boolean;
  inviteDelivery: "email" | "manual_link";
  manualActionLink: string | null;
};

export type AccountPlayerAdminItem = {
  player: AccountPlayer;
  linkedProfile: Profile | null;
  priorityGroup: AccountPriorityGroup | null;
  preferredPositions: ModalityPosition[];
};

export type WeeklyEventParticipantItem = {
  participant: EventParticipant;
  player: AccountPlayer;
  membership: AccountMembership | null;
  linkedProfile: Profile | null;
  priorityGroup: AccountPriorityGroup | null;
  preferredPositions: ModalityPosition[];
};

export type EventPollResultEntry = {
  id: string;
  label: string;
  description: string | null;
  votes: number;
  photoUrl: string | null;
};

export type EventPollResultSummary = {
  poll: EventPoll;
  totalVotes: number;
  entries: EventPollResultEntry[];
};

export type CreateAccountPlayerInput = {
  accountId: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  linkedProfileId: string | null;
  priorityGroupId: string | null;
  isDefaultForWeeklyList: boolean;
  createdBy: string;
  preferredPositionIds: string[];
};

export type UpdateAccountPlayerInput = {
  playerId: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
  linkedProfileId: string | null;
  priorityGroupId: string | null;
  isDefaultForWeeklyList: boolean;
  preferredPositionIds: string[];
};

export type UpsertAccountPlayerFromAccessInput = {
  accountId: string;
  fullName: string;
  email: string;
  photoUrl: string | null;
  linkedProfileId: string;
  priorityGroupId: string | null;
  isDefaultForWeeklyList: boolean;
  preferredPositionIds: string[];
  createdBy: string;
};

export type CreatePollTemplateInput = {
  accountId: string;
  title: string;
  description: string | null;
  selectionMode: "predefined_options" | "event_participant";
  createdBy: string;
};

export type UpdatePollTemplateInput = {
  pollTemplateId: string;
  title: string;
  description: string | null;
  selectionMode: "predefined_options" | "event_participant";
};

export type CreateSportsAccountInput = {
  createdBy: string;
  name: string;
  slug: string;
  modalityId: string;
  timezone: string;
  maxPlayersPerEvent: number;
  confirmationOpenHoursBefore: number;
  confirmationCloseMinutesBefore: number;
  autoNotifyConfirmationOpen: boolean;
  autoNotifyWaitlistChanges: boolean;
  autoNotifyEventUpdates: boolean;
  schedule: {
    weekday: number;
    startsAt: string;
    endsAt: string;
  };
  priorityGroups: Array<{
    name: string;
    colorHex: string | null;
  }>;
};

export type CreateSportModalityInput = {
  createdBy: string;
  name: string;
  slug: string;
  playersPerTeam: number;
  positions: string[];
};

export type UpdateSportModalityInput = {
  modalityId: string;
  name: string;
  slug: string;
  playersPerTeam: number;
  positions: string[];
};

export type UpdateSportsAccountInput = {
  accountId: string;
  name: string;
  slug: string;
  modalityId: string;
  timezone: string;
  maxPlayersPerEvent: number;
  confirmationOpenHoursBefore: number;
  confirmationCloseMinutesBefore: number;
  autoNotifyConfirmationOpen: boolean;
  autoNotifyWaitlistChanges: boolean;
  autoNotifyEventUpdates: boolean;
  schedule: {
    weekday: number;
    startsAt: string;
    endsAt: string;
  };
  priorityGroups: Array<{
    name: string;
    colorHex: string | null;
  }>;
};

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function toNormalizedCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const eventSelectFields =
  "id, account_id, schedule_id, title, starts_at, ends_at, confirmation_opens_at, confirmation_closes_at, max_players, status, notes, created_by, published_at, completed_at, created_at, updated_at";

const eventParticipantSelectFields =
  "id, event_id, membership_id, account_player_id, priority_group_id, priority_rank_snapshot, roster_order, response_status, selection_status, response_at, selection_changed_at, added_by, removed_reason, waitlist_notified_at, created_at, updated_at";

const eventPollSelectFields =
  "id, event_id, template_id, title, description, selection_mode, status, opens_at, closes_at, sort_order, created_by, created_at, updated_at";

function normalizeClockTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function getPriorityRank(priorityGroupId: string | null, priorityGroups: AccountPriorityGroup[]) {
  const matchedGroup = priorityGroups.find((group) => group.id === priorityGroupId);
  return matchedGroup?.priority_rank ?? 999;
}

function parseTimeParts(value: string) {
  const [hours, minutes, seconds] = normalizeClockTime(value)
    .split(":")
    .map((part) => Number(part));

  return {
    hours,
    minutes,
    seconds: Number.isFinite(seconds) ? seconds : 0,
  };
}

function getNextScheduleWindow(schedule: AccountSchedule) {
  const now = new Date();
  const { hours: startHours, minutes: startMinutes, seconds: startSeconds } = parseTimeParts(schedule.starts_at);
  const { hours: endHours, minutes: endMinutes, seconds: endSeconds } = parseTimeParts(schedule.ends_at);
  const currentWeekday = now.getDay();
  let daysUntilNext = (schedule.weekday - currentWeekday + 7) % 7;

  const startsAt = new Date(now);
  startsAt.setHours(startHours, startMinutes, startSeconds, 0);
  startsAt.setDate(now.getDate() + daysUntilNext);

  const endsAt = new Date(now);
  endsAt.setHours(endHours, endMinutes, endSeconds, 0);
  endsAt.setDate(now.getDate() + daysUntilNext);

  if (daysUntilNext === 0 && endsAt <= now) {
    startsAt.setDate(startsAt.getDate() + 7);
    endsAt.setDate(endsAt.getDate() + 7);
  }

  return {
    startsAt,
    endsAt,
  };
}

function buildEventTitle(accountName: string, startsAt: Date) {
  const formattedDate = startsAt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  return `${accountName} | ${formattedDate}`;
}

export async function listSportModalities(): Promise<SportModality[]> {
  const { data, error } = await supabase
    .from("sport_modalities")
    .select("id, name, slug, players_per_team, created_by, created_at, updated_at")
    .order("name", { ascending: true });

  throwIfError(error);
  return (data ?? []) as SportModality[];
}

export async function listAllSportsAccounts(): Promise<SportsAccount[]> {
  const { data, error } = await supabase
    .from("sports_accounts")
    .select(
      "id, name, slug, modality_id, timezone, max_players_per_event, confirmation_open_hours_before, confirmation_close_minutes_before, auto_notify_confirmation_open, auto_notify_waitlist_changes, auto_notify_event_updates, created_by, created_at, updated_at",
    )
    .order("name", { ascending: true });

  throwIfError(error);
  return (data ?? []) as SportsAccount[];
}

export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, photo_url, is_super_admin, created_at, updated_at")
    .ilike("email", email.trim().toLowerCase())
    .maybeSingle();

  throwIfError(error);
  return (data as Profile | null) ?? null;
}

export async function ensurePlayerLoginAccess(input: {
  accountId: string;
  email: string;
  fullName: string;
}): Promise<ProvisionedAuthProfile> {
  const { data, error } = await supabase.functions.invoke("provision-player-access", {
    body: {
      accountId: input.accountId,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const response = data as Partial<ProvisionedAuthProfile> & { error?: string };

  if (response.error) {
    throw new Error(response.error);
  }

  if (!response.profileId || !response.email || !response.fullName) {
    throw new Error("Nao foi possivel provisionar o login do jogador.");
  }

  return {
    profileId: response.profileId,
    email: response.email,
    fullName: response.fullName,
    invited: Boolean(response.invited),
    alreadyExisted: Boolean(response.alreadyExisted),
    inviteDelivery:
      response.inviteDelivery === "manual_link" ? "manual_link" : "email",
    manualActionLink: typeof response.manualActionLink === "string" ? response.manualActionLink : null,
  };
}

export async function listAllAccountMemberships(): Promise<AccountMembershipAdminItem[]> {
  const { data: membershipData, error: membershipError } = await supabase
    .from("account_memberships")
    .select(
      "id, account_id, profile_id, account_player_id, role, priority_group_id, is_active, joined_at, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  throwIfError(membershipError);

  const memberships = (membershipData ?? []) as AccountMembership[];

  if (memberships.length === 0) {
    return [];
  }

  const accountIds = [...new Set(memberships.map((membership) => membership.account_id))];
  const profileIds = [...new Set(memberships.map((membership) => membership.profile_id))];
  const priorityGroupIds = [
    ...new Set(
      memberships
        .map((membership) => membership.priority_group_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [
    { data: accountData, error: accountError },
    { data: profileData, error: profileError },
    { data: priorityGroupData, error: priorityGroupError },
  ] = await Promise.all([
    supabase
      .from("sports_accounts")
      .select(
        "id, name, slug, modality_id, timezone, max_players_per_event, confirmation_open_hours_before, confirmation_close_minutes_before, auto_notify_confirmation_open, auto_notify_waitlist_changes, auto_notify_event_updates, created_by, created_at, updated_at",
      )
      .in("id", accountIds),
    supabase
      .from("profiles")
      .select("id, full_name, email, photo_url, is_super_admin, created_at, updated_at")
      .in("id", profileIds),
    priorityGroupIds.length > 0
      ? supabase
          .from("account_priority_groups")
          .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
          .in("id", priorityGroupIds)
      : Promise.resolve({
          data: [] as AccountPriorityGroup[],
          error: null as { message: string } | null,
        }),
  ]);

  throwIfError(accountError);
  throwIfError(profileError);
  throwIfError(priorityGroupError);

  const accountMap = new Map(((accountData ?? []) as SportsAccount[]).map((account) => [account.id, account]));
  const profileMap = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const priorityGroupMap = new Map(
    ((priorityGroupData ?? []) as AccountPriorityGroup[]).map((group) => [group.id, group]),
  );

  return memberships
    .map((membership) => {
      const account = accountMap.get(membership.account_id);
      const profile = profileMap.get(membership.profile_id);

      if (!account || !profile) {
        return null;
      }

      return {
        membership,
        account,
        profile,
        priorityGroup: membership.priority_group_id
          ? priorityGroupMap.get(membership.priority_group_id) ?? null
          : null,
      } satisfies AccountMembershipAdminItem;
    })
    .filter((item): item is AccountMembershipAdminItem => item !== null)
    .sort((first, second) => {
      const accountOrder = first.account.name.localeCompare(second.account.name);

      if (accountOrder !== 0) {
        return accountOrder;
      }

      return first.profile.full_name.localeCompare(second.profile.full_name);
    });
}

export async function getAccountOverview(accountId: string): Promise<AccountOverview> {
  const { data: accountData, error: accountError } = await supabase
    .from("sports_accounts")
    .select(
      "id, name, slug, modality_id, timezone, max_players_per_event, confirmation_open_hours_before, confirmation_close_minutes_before, auto_notify_confirmation_open, auto_notify_waitlist_changes, auto_notify_event_updates, created_by, created_at, updated_at",
    )
    .eq("id", accountId)
    .single();

  throwIfError(accountError);

  const account = accountData as SportsAccount;

  const [
    { data: modalityData, error: modalityError },
    { data: scheduleData, error: scheduleError },
    { data: priorityGroupData, error: priorityGroupError },
    { data: membershipData, error: membershipError },
    { data: playerData, error: playerError },
    { data: pollTemplateData, error: pollTemplateError },
  ] = await Promise.all([
    supabase
      .from("sport_modalities")
      .select("id, name, slug, players_per_team, created_by, created_at, updated_at")
      .eq("id", account.modality_id)
      .single(),
    supabase
      .from("account_schedules")
      .select("id, account_id, weekday, starts_at, ends_at, is_active, created_at, updated_at")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("weekday", { ascending: true })
      .order("starts_at", { ascending: true }),
    supabase
      .from("account_priority_groups")
      .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("priority_rank", { ascending: true }),
    supabase
      .from("account_memberships")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_active", true),
    supabase
      .from("account_players")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_active", true),
    supabase
      .from("poll_templates")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_active", true),
  ]);

  throwIfError(modalityError);
  throwIfError(scheduleError);
  throwIfError(priorityGroupError);
  throwIfError(membershipError);
  throwIfError(playerError);
  throwIfError(pollTemplateError);

  return {
    account,
    modality: modalityData as SportModality,
    schedules: (scheduleData ?? []) as AccountSchedule[],
    priorityGroups: (priorityGroupData ?? []) as AccountPriorityGroup[],
    activeMemberCount: (membershipData ?? []).length,
    activePlayerCount: (playerData ?? []).length,
    activePollTemplateCount: (pollTemplateData ?? []).length,
  };
}

export async function listModalityPositions(modalityId: string): Promise<ModalityPosition[]> {
  const { data, error } = await supabase
    .from("modality_positions")
    .select("id, modality_id, name, code, sort_order, created_at, updated_at")
    .eq("modality_id", modalityId)
    .order("sort_order", { ascending: true });

  throwIfError(error);
  return (data ?? []) as ModalityPosition[];
}

export async function listAccountRoster(
  accountId: string,
  modalityId: string,
): Promise<RosterMember[]> {
  const { data: membershipData, error: membershipError } = await supabase
    .from("account_memberships")
    .select(
      "id, account_id, profile_id, account_player_id, role, priority_group_id, is_active, joined_at, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  throwIfError(membershipError);

  const memberships = (membershipData ?? []) as AccountMembership[];

  if (memberships.length === 0) {
    return [];
  }

  const profileIds = memberships.map((membership) => membership.profile_id);
  const membershipIds = memberships.map((membership) => membership.id);
  const priorityGroupIds = [
    ...new Set(
      memberships
        .map((membership) => membership.priority_group_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const profileQuery = supabase
    .from("profiles")
    .select("id, full_name, email, photo_url, is_super_admin, created_at, updated_at")
    .in("id", profileIds);

  const preferenceQuery = supabase
    .from("membership_position_preferences")
    .select("id, membership_id, modality_position_id, preference_order, created_at")
    .in("membership_id", membershipIds)
    .order("preference_order", { ascending: true });

  const positionQuery = supabase
    .from("modality_positions")
    .select("id, modality_id, name, code, sort_order, created_at, updated_at")
    .eq("modality_id", modalityId)
    .order("sort_order", { ascending: true });

  const priorityGroupQuery =
    priorityGroupIds.length > 0
      ? supabase
          .from("account_priority_groups")
          .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
          .in("id", priorityGroupIds)
      : Promise.resolve({
          data: [] as AccountPriorityGroup[],
          error: null as { message: string } | null,
        });

  const [
    { data: profileData, error: profileError },
    { data: preferenceData, error: preferenceError },
    { data: positionData, error: positionError },
    { data: priorityGroupData, error: priorityGroupError },
  ] = await Promise.all([profileQuery, preferenceQuery, positionQuery, priorityGroupQuery]);

  throwIfError(profileError);
  throwIfError(preferenceError);
  throwIfError(positionError);
  throwIfError(priorityGroupError);

  const profileMap = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const positionMap = new Map(
    ((positionData ?? []) as ModalityPosition[]).map((position) => [position.id, position]),
  );
  const priorityGroupMap = new Map(
    ((priorityGroupData ?? []) as AccountPriorityGroup[]).map((group) => [group.id, group]),
  );
  const preferencesByMembership = new Map<string, ModalityPosition[]>();

  for (const preference of preferenceData ?? []) {
    const resolvedPreference = preference as {
      membership_id: string;
      modality_position_id: string;
    };
    const position = positionMap.get(resolvedPreference.modality_position_id);

    if (!position) {
      continue;
    }

    const current = preferencesByMembership.get(resolvedPreference.membership_id) ?? [];
    current.push(position);
    preferencesByMembership.set(resolvedPreference.membership_id, current);
  }

  return memberships
    .map((membership) => {
      const profile = profileMap.get(membership.profile_id);

      if (!profile) {
        return null;
      }

      const priorityGroup = membership.priority_group_id
        ? priorityGroupMap.get(membership.priority_group_id) ?? null
        : null;

      return {
        membership,
        profile,
        priorityGroup,
        preferredPositions: preferencesByMembership.get(membership.id) ?? [],
      } satisfies RosterMember;
    })
    .filter((member): member is RosterMember => member !== null)
    .sort((first, second) => {
      const firstRank = first.priorityGroup?.priority_rank ?? Number.MAX_SAFE_INTEGER;
      const secondRank = second.priorityGroup?.priority_rank ?? Number.MAX_SAFE_INTEGER;

      if (firstRank !== secondRank) {
        return firstRank - secondRank;
      }

      return first.profile.full_name.localeCompare(second.profile.full_name);
    });
}

export async function updateSportsAccountBasics(input: {
  accountId: string;
  name: string;
  maxPlayersPerEvent: number;
  confirmationOpenHoursBefore: number;
  confirmationCloseMinutesBefore: number;
}) {
  const { error } = await supabase
    .from("sports_accounts")
    .update({
      name: input.name,
      max_players_per_event: input.maxPlayersPerEvent,
      confirmation_open_hours_before: input.confirmationOpenHoursBefore,
      confirmation_close_minutes_before: input.confirmationCloseMinutesBefore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.accountId);

  throwIfError(error);
}

export async function createSportModality(input: CreateSportModalityInput) {
  const { data: modalityData, error: modalityError } = await supabase
    .from("sport_modalities")
    .insert({
      name: input.name,
      slug: input.slug,
      players_per_team: input.playersPerTeam,
      created_by: input.createdBy,
    })
    .select("id, name, slug, players_per_team, created_by, created_at, updated_at")
    .single();

  throwIfError(modalityError);

  const modality = modalityData as SportModality;
  const uniquePositions = [...new Set(input.positions.map((position) => position.trim()).filter(Boolean))];

  if (uniquePositions.length > 0) {
    const { error: positionError } = await supabase.from("modality_positions").insert(
      uniquePositions.map((position, index) => ({
        modality_id: modality.id,
        name: position,
        code: toNormalizedCode(position),
        sort_order: index + 1,
      })),
    );

    throwIfError(positionError);
  }

  return modality;
}

export async function updateSportModality(input: UpdateSportModalityInput) {
  const { error: modalityError } = await supabase
    .from("sport_modalities")
    .update({
      name: input.name,
      slug: input.slug,
      players_per_team: input.playersPerTeam,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.modalityId);

  throwIfError(modalityError);

  const { data: existingPositionData, error: existingPositionError } = await supabase
    .from("modality_positions")
    .select("id, modality_id, name, code, sort_order, created_at, updated_at")
    .eq("modality_id", input.modalityId)
    .order("sort_order", { ascending: true });

  throwIfError(existingPositionError);

  const existingPositions = (existingPositionData ?? []) as ModalityPosition[];
  const desiredPositions = [...new Set(input.positions.map((position) => position.trim()).filter(Boolean))];
  const existingByCode = new Map(existingPositions.map((position) => [position.code, position]));
  const desiredCodes = new Set<string>();

  for (const [index, desiredPosition] of desiredPositions.entries()) {
    const code = toNormalizedCode(desiredPosition);
    desiredCodes.add(code);
    const existingPosition = existingByCode.get(code);

    if (existingPosition) {
      const { error: updatePositionError } = await supabase
        .from("modality_positions")
        .update({
          name: desiredPosition,
          sort_order: index + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPosition.id);

      throwIfError(updatePositionError);
      continue;
    }

    const { error: insertPositionError } = await supabase.from("modality_positions").insert({
      modality_id: input.modalityId,
      name: desiredPosition,
      code,
      sort_order: index + 1,
    });

    throwIfError(insertPositionError);
  }

  const removablePositions = existingPositions.filter((position) => !desiredCodes.has(position.code));

  for (const position of removablePositions) {
    const { error: deletePositionError } = await supabase
      .from("modality_positions")
      .delete()
      .eq("id", position.id);

    throwIfError(deletePositionError);
  }
}

export async function createSportsAccount(input: CreateSportsAccountInput) {
  const { data: accountData, error: accountError } = await supabase
    .from("sports_accounts")
    .insert({
      name: input.name,
      slug: input.slug,
      modality_id: input.modalityId,
      timezone: input.timezone,
      max_players_per_event: input.maxPlayersPerEvent,
      confirmation_open_hours_before: input.confirmationOpenHoursBefore,
      confirmation_close_minutes_before: input.confirmationCloseMinutesBefore,
      auto_notify_confirmation_open: input.autoNotifyConfirmationOpen,
      auto_notify_waitlist_changes: input.autoNotifyWaitlistChanges,
      auto_notify_event_updates: input.autoNotifyEventUpdates,
      created_by: input.createdBy,
    })
    .select(
      "id, name, slug, modality_id, timezone, max_players_per_event, confirmation_open_hours_before, confirmation_close_minutes_before, auto_notify_confirmation_open, auto_notify_waitlist_changes, auto_notify_event_updates, created_by, created_at, updated_at",
    )
    .single();

  throwIfError(accountError);

  const account = accountData as SportsAccount;

  const scheduleStartsAt = input.schedule.startsAt.length === 5
    ? `${input.schedule.startsAt}:00`
    : input.schedule.startsAt;
  const scheduleEndsAt = input.schedule.endsAt.length === 5
    ? `${input.schedule.endsAt}:00`
    : input.schedule.endsAt;

  const scheduleQuery = supabase.from("account_schedules").insert({
    account_id: account.id,
    weekday: input.schedule.weekday,
    starts_at: scheduleStartsAt,
    ends_at: scheduleEndsAt,
    is_active: true,
  });

  const priorityGroupsQuery =
    input.priorityGroups.length > 0
      ? supabase.from("account_priority_groups").insert(
          input.priorityGroups.map((group, index) => ({
            account_id: account.id,
            name: group.name,
            priority_rank: index + 1,
            color_hex: group.colorHex,
            is_active: true,
          })),
        )
      : Promise.resolve({ error: null as { message: string } | null });

  const [{ error: scheduleError }, { error: priorityGroupsError }] = await Promise.all([
    scheduleQuery,
    priorityGroupsQuery,
  ]);

  throwIfError(scheduleError);
  throwIfError(priorityGroupsError);

  return account;
}

export async function updateSportsAccount(input: UpdateSportsAccountInput) {
  const { error: accountError } = await supabase
    .from("sports_accounts")
    .update({
      name: input.name,
      slug: input.slug,
      modality_id: input.modalityId,
      timezone: input.timezone,
      max_players_per_event: input.maxPlayersPerEvent,
      confirmation_open_hours_before: input.confirmationOpenHoursBefore,
      confirmation_close_minutes_before: input.confirmationCloseMinutesBefore,
      auto_notify_confirmation_open: input.autoNotifyConfirmationOpen,
      auto_notify_waitlist_changes: input.autoNotifyWaitlistChanges,
      auto_notify_event_updates: input.autoNotifyEventUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.accountId);

  throwIfError(accountError);

  const [
    { data: scheduleData, error: scheduleError },
    { data: priorityGroupData, error: priorityGroupError },
  ] = await Promise.all([
    supabase
      .from("account_schedules")
      .select("id, account_id, weekday, starts_at, ends_at, is_active, created_at, updated_at")
      .eq("account_id", input.accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("account_priority_groups")
      .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
      .eq("account_id", input.accountId)
      .order("priority_rank", { ascending: true }),
  ]);

  throwIfError(scheduleError);
  throwIfError(priorityGroupError);

  const existingSchedules = (scheduleData ?? []) as AccountSchedule[];
  const existingPriorityGroups = (priorityGroupData ?? []) as AccountPriorityGroup[];
  const normalizedStartsAt =
    input.schedule.startsAt.length === 5 ? `${input.schedule.startsAt}:00` : input.schedule.startsAt;
  const normalizedEndsAt =
    input.schedule.endsAt.length === 5 ? `${input.schedule.endsAt}:00` : input.schedule.endsAt;

  if (existingSchedules[0]) {
    const { error: primaryScheduleError } = await supabase
      .from("account_schedules")
      .update({
        weekday: input.schedule.weekday,
        starts_at: normalizedStartsAt,
        ends_at: normalizedEndsAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSchedules[0].id);

    throwIfError(primaryScheduleError);
  } else {
    const { error: insertScheduleError } = await supabase.from("account_schedules").insert({
      account_id: input.accountId,
      weekday: input.schedule.weekday,
      starts_at: normalizedStartsAt,
      ends_at: normalizedEndsAt,
      is_active: true,
    });

    throwIfError(insertScheduleError);
  }

  const extraSchedules = existingSchedules.slice(1);

  for (const schedule of extraSchedules) {
    const { error: deleteScheduleError } = await supabase
      .from("account_schedules")
      .delete()
      .eq("id", schedule.id);

    throwIfError(deleteScheduleError);
  }

  for (const [index, group] of input.priorityGroups.entries()) {
    const existingGroup = existingPriorityGroups[index];

    if (existingGroup) {
      const { error: updateGroupError } = await supabase
        .from("account_priority_groups")
        .update({
          name: group.name,
          priority_rank: index + 1,
          color_hex: group.colorHex,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingGroup.id);

      throwIfError(updateGroupError);
      continue;
    }

    const { error: insertGroupError } = await supabase.from("account_priority_groups").insert({
      account_id: input.accountId,
      name: group.name,
      priority_rank: index + 1,
      color_hex: group.colorHex,
      is_active: true,
    });

    throwIfError(insertGroupError);
  }

  const extraGroups = existingPriorityGroups.slice(input.priorityGroups.length);

  for (const [offset, group] of extraGroups.entries()) {
    const { error: archiveGroupError } = await supabase
      .from("account_priority_groups")
      .update({
        name: `__inactive_${group.id}`,
        priority_rank: 1000 + offset,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", group.id);

    throwIfError(archiveGroupError);
  }
}

async function replaceAccountPlayerPositionPreferences(
  accountPlayerId: string,
  orderedPositionIds: string[],
) {
  const uniqueOrderedPositionIds = [...new Set(orderedPositionIds)];

  const { error: deleteError } = await supabase
    .from("account_player_position_preferences")
    .delete()
    .eq("account_player_id", accountPlayerId);

  throwIfError(deleteError);

  if (uniqueOrderedPositionIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("account_player_position_preferences")
    .insert(
      uniqueOrderedPositionIds.map((positionId, index) => ({
        account_player_id: accountPlayerId,
        modality_position_id: positionId,
        preference_order: index + 1,
      })),
    );

  throwIfError(insertError);
}

async function syncPlayerMembership(input: {
  accountId: string;
  linkedProfileId: string | null;
  accountPlayerId: string;
  priorityGroupId: string | null;
}) {
  if (!input.linkedProfileId) {
    return;
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("account_memberships")
    .select(
      "id, account_id, profile_id, account_player_id, role, priority_group_id, is_active, joined_at, created_at, updated_at",
    )
    .eq("account_id", input.accountId)
    .eq("profile_id", input.linkedProfileId)
    .maybeSingle();

  throwIfError(membershipError);

  const existingMembership = (membershipData as AccountMembership | null) ?? null;

  await upsertAccountMembership({
    accountId: input.accountId,
    profileId: input.linkedProfileId,
    accountPlayerId: input.accountPlayerId,
    role: existingMembership?.role ?? "player",
    priorityGroupId: input.priorityGroupId,
  });
}

export async function listAccountPlayers(
  accountId: string,
  modalityId: string,
): Promise<AccountPlayerAdminItem[]> {
  const { data: playerData, error: playerError } = await supabase
    .from("account_players")
    .select(
      "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  throwIfError(playerError);

  const players = (playerData ?? []) as AccountPlayer[];

  if (players.length === 0) {
    return [];
  }

  const linkedProfileIds = [
    ...new Set(players.map((player) => player.linked_profile_id).filter((value): value is string => Boolean(value))),
  ];
  const priorityGroupIds = [
    ...new Set(players.map((player) => player.priority_group_id).filter((value): value is string => Boolean(value))),
  ];
  const playerIds = players.map((player) => player.id);

  const [
    { data: profileData, error: profileError },
    { data: priorityGroupData, error: priorityGroupError },
    { data: preferenceData, error: preferenceError },
    { data: positionData, error: positionError },
  ] = await Promise.all([
    linkedProfileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, photo_url, is_super_admin, created_at, updated_at")
          .in("id", linkedProfileIds)
      : Promise.resolve({ data: [] as Profile[], error: null as { message: string } | null }),
    priorityGroupIds.length > 0
      ? supabase
          .from("account_priority_groups")
          .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
          .in("id", priorityGroupIds)
      : Promise.resolve({
          data: [] as AccountPriorityGroup[],
          error: null as { message: string } | null,
        }),
    supabase
      .from("account_player_position_preferences")
      .select("id, account_player_id, modality_position_id, preference_order, created_at")
      .in("account_player_id", playerIds)
      .order("preference_order", { ascending: true }),
    supabase
      .from("modality_positions")
      .select("id, modality_id, name, code, sort_order, created_at, updated_at")
      .eq("modality_id", modalityId)
      .order("sort_order", { ascending: true }),
  ]);

  throwIfError(profileError);
  throwIfError(priorityGroupError);
  throwIfError(preferenceError);
  throwIfError(positionError);

  const profileMap = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const priorityGroupMap = new Map(
    ((priorityGroupData ?? []) as AccountPriorityGroup[]).map((group) => [group.id, group]),
  );
  const positionMap = new Map(
    ((positionData ?? []) as ModalityPosition[]).map((position) => [position.id, position]),
  );
  const preferencesByPlayer = new Map<string, ModalityPosition[]>();

  for (const preference of (preferenceData ?? []) as AccountPlayerPositionPreference[]) {
    const position = positionMap.get(preference.modality_position_id);

    if (!position) {
      continue;
    }

    const current = preferencesByPlayer.get(preference.account_player_id) ?? [];
    current.push(position);
    preferencesByPlayer.set(preference.account_player_id, current);
  }

  return players.map((player) => ({
    player,
    linkedProfile: player.linked_profile_id ? profileMap.get(player.linked_profile_id) ?? null : null,
    priorityGroup: player.priority_group_id ? priorityGroupMap.get(player.priority_group_id) ?? null : null,
    preferredPositions: preferencesByPlayer.get(player.id) ?? [],
  }));
}

async function listActiveMembershipsForAccount(accountId: string) {
  const { data, error } = await supabase
    .from("account_memberships")
    .select(
      "id, account_id, profile_id, account_player_id, role, priority_group_id, is_active, joined_at, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("is_active", true);

  throwIfError(error);
  return (data ?? []) as AccountMembership[];
}

async function resequenceWeeklyEventParticipants(eventId: string) {
  const { data: participantData, error: participantError } = await supabase
    .from("event_participants")
    .select(eventParticipantSelectFields)
    .eq("event_id", eventId)
    .eq("selection_status", "active");

  throwIfError(participantError);

  const participants = (participantData ?? []) as EventParticipant[];

  if (participants.length === 0) {
    return;
  }

  const playerIds = [
    ...new Set(
      participants
        .map((participant) => participant.account_player_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: playerData, error: playerError } = await supabase
    .from("account_players")
    .select("id, full_name")
    .in("id", playerIds);

  throwIfError(playerError);

  const playerNameById = new Map(
    ((playerData ?? []) as Pick<AccountPlayer, "id" | "full_name">[]).map((player) => [
      player.id,
      player.full_name,
    ]),
  );

  const sortedParticipants = [...participants].sort((first, second) => {
    if (first.priority_rank_snapshot !== second.priority_rank_snapshot) {
      return first.priority_rank_snapshot - second.priority_rank_snapshot;
    }

    const firstName = playerNameById.get(first.account_player_id ?? "") ?? "";
    const secondName = playerNameById.get(second.account_player_id ?? "") ?? "";
    const nameOrder = firstName.localeCompare(secondName);

    if (nameOrder !== 0) {
      return nameOrder;
    }

    return first.created_at.localeCompare(second.created_at);
  });

  for (const [index, participant] of sortedParticipants.entries()) {
    const nextRosterOrder = index + 1;

    if (participant.roster_order === nextRosterOrder) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("event_participants")
      .update({
        roster_order: nextRosterOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", participant.id);

    throwIfError(updateError);
  }
}

export async function getCurrentWeeklyEvent(accountId: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from("events")
    .select(eventSelectFields)
    .eq("account_id", accountId)
    .in("status", ["draft", "published"])
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  throwIfError(error);
  return (data as Event | null) ?? null;
}

export async function getLatestWeeklyEvent(accountId: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from("events")
    .select(eventSelectFields)
    .eq("account_id", accountId)
    .in("status", ["draft", "published", "completed"])
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(error);
  return (data as Event | null) ?? null;
}

export async function listWeeklyEventParticipants(
  eventId: string,
  modalityId: string,
): Promise<WeeklyEventParticipantItem[]> {
  const { data: participantData, error: participantError } = await supabase
    .from("event_participants")
    .select(eventParticipantSelectFields)
    .eq("event_id", eventId)
    .order("priority_rank_snapshot", { ascending: true })
    .order("roster_order", { ascending: true })
    .order("created_at", { ascending: true });

  throwIfError(participantError);

  const participants = (participantData ?? []) as EventParticipant[];

  if (participants.length === 0) {
    return [];
  }

  const membershipIds = [
    ...new Set(
      participants
        .map((participant) => participant.membership_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: membershipData, error: membershipError } =
    membershipIds.length > 0
      ? await supabase
          .from("account_memberships")
          .select(
            "id, account_id, profile_id, account_player_id, role, priority_group_id, is_active, joined_at, created_at, updated_at",
          )
          .in("id", membershipIds)
      : { data: [] as AccountMembership[], error: null as { message: string } | null };

  throwIfError(membershipError);

  const membershipMap = new Map(
    ((membershipData ?? []) as AccountMembership[]).map((membership) => [membership.id, membership]),
  );

  const playerIds = [
    ...new Set(
      participants
        .map((participant) => participant.account_player_id ?? membershipMap.get(participant.membership_id ?? "")?.account_player_id ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: playerData, error: playerError } = await supabase
    .from("account_players")
    .select(
      "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
    )
    .in("id", playerIds);

  throwIfError(playerError);

  const players = (playerData ?? []) as AccountPlayer[];
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const linkedProfileIds = [
    ...new Set(players.map((player) => player.linked_profile_id).filter((value): value is string => Boolean(value))),
  ];
  const priorityGroupIds = [
    ...new Set(
      participants
        .map((participant) => participant.priority_group_id)
        .concat(players.map((player) => player.priority_group_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [
    { data: profileData, error: profileError },
    { data: priorityGroupData, error: priorityGroupError },
    { data: preferenceData, error: preferenceError },
    { data: positionData, error: positionError },
  ] = await Promise.all([
    linkedProfileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, photo_url, is_super_admin, created_at, updated_at")
          .in("id", linkedProfileIds)
      : Promise.resolve({ data: [] as Profile[], error: null as { message: string } | null }),
    priorityGroupIds.length > 0
      ? supabase
          .from("account_priority_groups")
          .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
          .in("id", priorityGroupIds)
      : Promise.resolve({
          data: [] as AccountPriorityGroup[],
          error: null as { message: string } | null,
        }),
    playerIds.length > 0
      ? supabase
          .from("account_player_position_preferences")
          .select("id, account_player_id, modality_position_id, preference_order, created_at")
          .in("account_player_id", playerIds)
          .order("preference_order", { ascending: true })
      : Promise.resolve({
          data: [] as AccountPlayerPositionPreference[],
          error: null as { message: string } | null,
        }),
    supabase
      .from("modality_positions")
      .select("id, modality_id, name, code, sort_order, created_at, updated_at")
      .eq("modality_id", modalityId)
      .order("sort_order", { ascending: true }),
  ]);

  throwIfError(profileError);
  throwIfError(priorityGroupError);
  throwIfError(preferenceError);
  throwIfError(positionError);

  const profileMap = new Map(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]));
  const priorityGroupMap = new Map(
    ((priorityGroupData ?? []) as AccountPriorityGroup[]).map((group) => [group.id, group]),
  );
  const positionMap = new Map(
    ((positionData ?? []) as ModalityPosition[]).map((position) => [position.id, position]),
  );
  const preferencesByPlayer = new Map<string, ModalityPosition[]>();

  for (const preference of (preferenceData ?? []) as AccountPlayerPositionPreference[]) {
    const position = positionMap.get(preference.modality_position_id);

    if (!position) {
      continue;
    }

    const current = preferencesByPlayer.get(preference.account_player_id) ?? [];
    current.push(position);
    preferencesByPlayer.set(preference.account_player_id, current);
  }

  return participants
    .map((participant) => {
      const membership = participant.membership_id
        ? membershipMap.get(participant.membership_id) ?? null
        : null;
      const playerId = participant.account_player_id ?? membership?.account_player_id ?? null;
      const player = playerId ? playerMap.get(playerId) ?? null : null;

      if (!player) {
        return null;
      }

      const priorityGroupId = participant.priority_group_id ?? player.priority_group_id ?? null;

      return {
        participant,
        player,
        membership,
        linkedProfile: player.linked_profile_id ? profileMap.get(player.linked_profile_id) ?? null : null,
        priorityGroup: priorityGroupId ? priorityGroupMap.get(priorityGroupId) ?? null : null,
        preferredPositions: preferencesByPlayer.get(player.id) ?? [],
      } satisfies WeeklyEventParticipantItem;
    })
    .filter((item): item is WeeklyEventParticipantItem => item !== null)
    .sort((first, second) => {
      if (first.participant.selection_status !== second.participant.selection_status) {
        return first.participant.selection_status.localeCompare(second.participant.selection_status);
      }

      if (first.participant.priority_rank_snapshot !== second.participant.priority_rank_snapshot) {
        return first.participant.priority_rank_snapshot - second.participant.priority_rank_snapshot;
      }

      if (first.participant.roster_order !== second.participant.roster_order) {
        return first.participant.roster_order - second.participant.roster_order;
      }

      return first.player.full_name.localeCompare(second.player.full_name);
    });
}

export async function listEventPolls(eventId: string): Promise<EventPoll[]> {
  const { data, error } = await supabase
    .from("event_polls")
    .select(eventPollSelectFields)
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  throwIfError(error);
  return (data ?? []) as EventPoll[];
}

export async function listEventPollResults(eventId: string): Promise<EventPollResultSummary[]> {
  const polls = await listEventPolls(eventId);

  if (polls.length === 0) {
    return [];
  }

  const pollIds = polls.map((poll) => poll.id);
  const [
    { data: optionData, error: optionError },
    { data: voteData, error: voteError },
  ] = await Promise.all([
    supabase
      .from("event_poll_options")
      .select("id, poll_id, target_participant_id, label, description, sort_order, created_by, created_at, updated_at")
      .in("poll_id", pollIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("event_poll_votes")
      .select("id, poll_id, voter_participant_id, option_id, target_participant_id, created_at")
      .in("poll_id", pollIds),
  ]);

  throwIfError(optionError);
  throwIfError(voteError);

  const options = (optionData ?? []) as EventPollOption[];
  const votes = (voteData ?? []) as EventPollVote[];
  const participantIds = [
    ...new Set(
      options
        .map((option) => option.target_participant_id)
        .concat(votes.map((vote) => vote.target_participant_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  let participantMap = new Map<string, EventParticipant>();
  let playerMap = new Map<string, AccountPlayer>();

  if (participantIds.length > 0) {
    const { data: participantData, error: participantError } = await supabase
      .from("event_participants")
      .select(eventParticipantSelectFields)
      .in("id", participantIds);

    throwIfError(participantError);

    const participants = (participantData ?? []) as EventParticipant[];
    participantMap = new Map(participants.map((participant) => [participant.id, participant]));

    const playerIds = [
      ...new Set(
        participants
          .map((participant) => participant.account_player_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    if (playerIds.length > 0) {
      const { data: playerData, error: playerError } = await supabase
        .from("account_players")
        .select(
          "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
        )
        .in("id", playerIds);

      throwIfError(playerError);
      playerMap = new Map(((playerData ?? []) as AccountPlayer[]).map((player) => [player.id, player]));
    }
  }

  return polls.map((poll) => {
    const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
    const totalVotes = pollVotes.length;

    if (poll.selection_mode === "predefined_options") {
      const entries: EventPollResultEntry[] = options
        .filter((option) => option.poll_id === poll.id)
        .map((option) => {
          const targetParticipant = option.target_participant_id
            ? participantMap.get(option.target_participant_id) ?? null
            : null;
          const targetPlayer = targetParticipant?.account_player_id
            ? playerMap.get(targetParticipant.account_player_id) ?? null
            : null;

          return {
            id: option.id,
            label: option.label,
            description: option.description ?? null,
            votes: pollVotes.filter((vote) => vote.option_id === option.id).length,
            photoUrl: targetPlayer?.photo_url ?? null,
          };
        })
        .sort((first, second) => {
          if (first.votes !== second.votes) {
            return second.votes - first.votes;
          }

          return first.label.localeCompare(second.label);
        });

      return {
        poll,
        totalVotes,
        entries,
      } satisfies EventPollResultSummary;
    }

    const voteCountByParticipant = new Map<string, number>();

    for (const vote of pollVotes) {
      if (!vote.target_participant_id) {
        continue;
      }

      voteCountByParticipant.set(
        vote.target_participant_id,
        (voteCountByParticipant.get(vote.target_participant_id) ?? 0) + 1,
      );
    }

    const entries: EventPollResultEntry[] = [...voteCountByParticipant.entries()].reduce<
      EventPollResultEntry[]
    >((current, [participantId, count]) => {
        const participant = participantMap.get(participantId) ?? null;
        const player = participant?.account_player_id
          ? playerMap.get(participant.account_player_id) ?? null
          : null;

        if (!player) {
          return current;
        }

        current.push({
          id: participantId,
          label: player.full_name,
          description: null,
          votes: count,
          photoUrl: player.photo_url ?? null,
        });

        return current;
      }, []).sort((first, second) => {
        if (first.votes !== second.votes) {
          return second.votes - first.votes;
        }

        return first.label.localeCompare(second.label);
      });

    return {
      poll,
      totalVotes,
      entries,
    } satisfies EventPollResultSummary;
  });
}

export async function createWeeklyEventCall(input: {
  account: SportsAccount;
  schedule: AccountSchedule;
  priorityGroups: AccountPriorityGroup[];
  createdBy: string;
}) {
  const existingEvent = await getCurrentWeeklyEvent(input.account.id);

  if (existingEvent) {
    throw new Error("Ja existe uma chamada semanal aberta para essa conta.");
  }

  const { startsAt, endsAt } = getNextScheduleWindow(input.schedule);
  const confirmationOpensAt = new Date(startsAt);
  confirmationOpensAt.setHours(
    confirmationOpensAt.getHours() - input.account.confirmation_open_hours_before,
  );

  const confirmationClosesAt = new Date(startsAt);
  confirmationClosesAt.setMinutes(
    confirmationClosesAt.getMinutes() - input.account.confirmation_close_minutes_before,
  );

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .insert({
      account_id: input.account.id,
      schedule_id: input.schedule.id,
      title: buildEventTitle(input.account.name, startsAt),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      confirmation_opens_at: confirmationOpensAt.toISOString(),
      confirmation_closes_at: confirmationClosesAt.toISOString(),
      max_players: input.account.max_players_per_event,
      status: "draft",
      created_by: input.createdBy,
    })
    .select(eventSelectFields)
    .single();

  throwIfError(eventError);

  const createdEvent = eventData as Event;
  const [defaultPlayers, memberships] = await Promise.all([
    supabase
      .from("account_players")
      .select(
        "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
      )
      .eq("account_id", input.account.id)
      .eq("is_active", true)
      .eq("is_default_for_weekly_list", true)
      .order("full_name", { ascending: true }),
    listActiveMembershipsForAccount(input.account.id),
  ]);

  throwIfError(defaultPlayers.error);

  const players = ((defaultPlayers.data ?? []) as AccountPlayer[]).sort((first, second) => {
    const firstRank = getPriorityRank(first.priority_group_id, input.priorityGroups);
    const secondRank = getPriorityRank(second.priority_group_id, input.priorityGroups);

    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    return first.full_name.localeCompare(second.full_name);
  });

  if (players.length > 0) {
    const membershipByPlayerId = new Map(
      memberships
        .filter((membership) => membership.account_player_id)
        .map((membership) => [membership.account_player_id as string, membership]),
    );

    const { error: insertParticipantError } = await supabase.from("event_participants").insert(
      players.map((player, index) => {
        const membership = membershipByPlayerId.get(player.id) ?? null;

        return {
          event_id: createdEvent.id,
          membership_id: membership?.id ?? null,
          account_player_id: player.id,
          priority_group_id: player.priority_group_id,
          priority_rank_snapshot: getPriorityRank(player.priority_group_id, input.priorityGroups),
          roster_order: index + 1,
          response_status: "pending",
          selection_status: "active",
          added_by: input.createdBy,
        };
      }),
    );

    throwIfError(insertParticipantError);
  }

  return createdEvent;
}

async function getDraftWeeklyEvent(eventId: string) {
  const { data, error } = await supabase
    .from("events")
    .select(eventSelectFields)
    .eq("id", eventId)
    .single();

  throwIfError(error);

  const event = data as Event;

  if (event.status !== "draft") {
    throw new Error("A lista da semana ja foi fechada e nao pode mais ser alterada.");
  }

  return event;
}

export async function addPlayerToWeeklyEvent(input: {
  eventId: string;
  playerId: string;
  addedBy: string;
}) {
  const event = await getDraftWeeklyEvent(input.eventId);

  const [
    { data: playerData, error: playerError },
    memberships,
    { data: priorityGroupData, error: priorityGroupError },
    { data: existingParticipantData, error: existingParticipantError },
  ] = await Promise.all([
    supabase
      .from("account_players")
      .select(
        "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
      )
      .eq("id", input.playerId)
      .single(),
    listActiveMembershipsForAccount(event.account_id),
    supabase
      .from("account_priority_groups")
      .select("id, account_id, name, priority_rank, color_hex, is_active, created_at, updated_at")
      .eq("account_id", event.account_id)
      .eq("is_active", true),
    supabase
      .from("event_participants")
      .select(eventParticipantSelectFields)
      .eq("event_id", input.eventId)
      .eq("account_player_id", input.playerId)
      .maybeSingle(),
  ]);

  throwIfError(playerError);
  throwIfError(priorityGroupError);
  throwIfError(existingParticipantError);

  const player = playerData as AccountPlayer;
  const membership =
    memberships.find((item) => item.account_player_id === input.playerId) ?? null;
  const priorityGroups = (priorityGroupData ?? []) as AccountPriorityGroup[];
  const priorityRankSnapshot = getPriorityRank(player.priority_group_id, priorityGroups);
  const existingParticipant = (existingParticipantData as EventParticipant | null) ?? null;

  if (existingParticipant) {
    const { error: updateError } = await supabase
      .from("event_participants")
      .update({
        membership_id: membership?.id ?? null,
        priority_group_id: player.priority_group_id,
        priority_rank_snapshot: priorityRankSnapshot,
        selection_status: "active",
        removed_reason: null,
        selection_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingParticipant.id);

    throwIfError(updateError);
  } else {
    const { error: insertError } = await supabase.from("event_participants").insert({
      event_id: input.eventId,
      membership_id: membership?.id ?? null,
      account_player_id: input.playerId,
      priority_group_id: player.priority_group_id,
      priority_rank_snapshot: priorityRankSnapshot,
      roster_order: 999,
      response_status: "pending",
      selection_status: "active",
      added_by: input.addedBy,
    });

    throwIfError(insertError);
  }

  await resequenceWeeklyEventParticipants(input.eventId);
}

export async function removePlayerFromWeeklyEvent(input: {
  eventParticipantId: string;
}) {
  const { data: participantData, error: participantError } = await supabase
    .from("event_participants")
    .select(eventParticipantSelectFields)
    .eq("id", input.eventParticipantId)
    .single();

  throwIfError(participantError);

  const participant = participantData as EventParticipant;
  await getDraftWeeklyEvent(participant.event_id);

  const { error: updateError } = await supabase
    .from("event_participants")
    .update({
      selection_status: "removed",
      removed_reason: "manual_remove",
      selection_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.eventParticipantId);

  throwIfError(updateError);
  await resequenceWeeklyEventParticipants(participant.event_id);
}

export async function closeWeeklyEventList(eventId: string) {
  await getDraftWeeklyEvent(eventId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("events")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", eventId);

  throwIfError(error);
}

export async function createEventPollsFromTemplates(input: {
  accountId: string;
  eventId: string;
  createdBy: string;
}) {
  const [{ data: eventData, error: eventError }, existingPolls, templates] = await Promise.all([
    supabase.from("events").select(eventSelectFields).eq("id", input.eventId).single(),
    listEventPolls(input.eventId),
    listAccountPollTemplates(input.accountId),
  ]);

  throwIfError(eventError);

  const event = eventData as Event;

  if (event.status !== "published") {
    throw new Error("Feche a lista semanal antes de criar as enquetes do evento.");
  }

  if (existingPolls.length > 0) {
    throw new Error("As enquetes desse evento ja foram criadas.");
  }

  if (templates.length === 0) {
    throw new Error("Cadastre pelo menos uma enquete recorrente para essa conta.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("event_polls").insert(
    templates.map((template, index) => ({
      event_id: input.eventId,
      template_id: template.id,
      title: template.title,
      description: template.description,
      selection_mode: template.selection_mode,
      status: "open",
      opens_at: now,
      sort_order: template.sort_order || index + 1,
      created_by: input.createdBy,
    })),
  );

  throwIfError(error);
}

export async function completeWeeklyEvent(eventId: string) {
  const now = new Date().toISOString();
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select(eventSelectFields)
    .eq("id", eventId)
    .single();

  throwIfError(eventError);

  const event = eventData as Event;

  if (event.status === "completed") {
    return;
  }

  const { error: eventUpdateError } = await supabase
    .from("events")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", eventId);

  throwIfError(eventUpdateError);

  const { error: pollUpdateError } = await supabase
    .from("event_polls")
    .update({
      status: "closed",
      closes_at: now,
      updated_at: now,
    })
    .eq("event_id", eventId)
    .in("status", ["draft", "open"]);

  throwIfError(pollUpdateError);
}

export async function createAccountPlayer(input: CreateAccountPlayerInput) {
  const normalizedEmail = input.email?.trim().toLowerCase() || null;

  const { data: playerData, error: playerError } = await supabase
    .from("account_players")
    .insert({
      account_id: input.accountId,
      linked_profile_id: input.linkedProfileId,
      full_name: input.fullName,
      email: normalizedEmail,
      photo_url: input.photoUrl,
      priority_group_id: input.priorityGroupId,
      is_default_for_weekly_list: input.isDefaultForWeeklyList,
      is_active: true,
      created_by: input.createdBy,
    })
    .select(
      "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
    )
    .single();

  throwIfError(playerError);

  const player = playerData as AccountPlayer;

  await replaceAccountPlayerPositionPreferences(player.id, input.preferredPositionIds);
  await syncPlayerMembership({
    accountId: input.accountId,
    linkedProfileId: input.linkedProfileId,
    accountPlayerId: player.id,
    priorityGroupId: input.priorityGroupId,
  });

  return player;
}

export async function updateAccountPlayer(input: UpdateAccountPlayerInput) {
  const { data: existingPlayerData, error: existingPlayerError } = await supabase
    .from("account_players")
    .select(
      "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
    )
    .eq("id", input.playerId)
    .single();

  throwIfError(existingPlayerError);

  const existingPlayer = existingPlayerData as AccountPlayer;
  const normalizedEmail = input.email?.trim().toLowerCase() || null;

  const { error: updateError } = await supabase
    .from("account_players")
    .update({
      linked_profile_id: input.linkedProfileId,
      full_name: input.fullName,
      email: normalizedEmail,
      photo_url: input.photoUrl,
      priority_group_id: input.priorityGroupId,
      is_default_for_weekly_list: input.isDefaultForWeeklyList,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.playerId);

  throwIfError(updateError);

  await replaceAccountPlayerPositionPreferences(input.playerId, input.preferredPositionIds);
  await syncPlayerMembership({
    accountId: existingPlayer.account_id,
    linkedProfileId: input.linkedProfileId,
    accountPlayerId: input.playerId,
    priorityGroupId: input.priorityGroupId,
  });
}

export async function upsertAccountPlayerFromAccess(
  input: UpsertAccountPlayerFromAccessInput,
): Promise<AccountPlayer> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const { data: linkedPlayerData, error: linkedPlayerError } = await supabase
    .from("account_players")
    .select(
      "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
    )
    .eq("account_id", input.accountId)
    .eq("linked_profile_id", input.linkedProfileId)
    .maybeSingle();

  throwIfError(linkedPlayerError);

  let existingPlayer = (linkedPlayerData as AccountPlayer | null) ?? null;

  if (!existingPlayer) {
    const { data: emailPlayerData, error: emailPlayerError } = await supabase
      .from("account_players")
      .select(
        "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
      )
      .eq("account_id", input.accountId)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    throwIfError(emailPlayerError);
    existingPlayer = (emailPlayerData as AccountPlayer | null) ?? null;
  }

  if (existingPlayer) {
      await updateAccountPlayer({
        playerId: existingPlayer.id,
        fullName: input.fullName,
        email: normalizedEmail,
        photoUrl: input.photoUrl,
        linkedProfileId: input.linkedProfileId,
        priorityGroupId: input.priorityGroupId,
        isDefaultForWeeklyList: input.isDefaultForWeeklyList,
        preferredPositionIds: input.preferredPositionIds,
      });

    const { data: updatedPlayerData, error: updatedPlayerError } = await supabase
      .from("account_players")
      .select(
        "id, account_id, linked_profile_id, full_name, email, photo_url, priority_group_id, is_default_for_weekly_list, is_active, created_by, created_at, updated_at",
      )
      .eq("id", existingPlayer.id)
      .single();

    throwIfError(updatedPlayerError);
    return updatedPlayerData as AccountPlayer;
  }

  return createAccountPlayer({
    accountId: input.accountId,
    fullName: input.fullName,
    email: normalizedEmail,
      photoUrl: input.photoUrl,
      linkedProfileId: input.linkedProfileId,
      priorityGroupId: input.priorityGroupId,
      isDefaultForWeeklyList: input.isDefaultForWeeklyList,
      createdBy: input.createdBy,
      preferredPositionIds: input.preferredPositionIds,
    });
  }

export async function deactivateAccountPlayer(playerId: string) {
  const { error } = await supabase
    .from("account_players")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId);

  throwIfError(error);
}

export async function listAccountPollTemplates(accountId: string): Promise<PollTemplate[]> {
  const { data, error } = await supabase
    .from("poll_templates")
    .select("id, account_id, title, description, selection_mode, is_active, sort_order, created_by, created_at, updated_at")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  throwIfError(error);
  return (data ?? []) as PollTemplate[];
}

export async function createPollTemplate(input: CreatePollTemplateInput) {
  const { data: lastTemplateData, error: lastTemplateError } = await supabase
    .from("poll_templates")
    .select("sort_order")
    .eq("account_id", input.accountId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(lastTemplateError);

  const nextSortOrder =
    typeof lastTemplateData?.sort_order === "number" ? lastTemplateData.sort_order + 1 : 1;

  const { data, error } = await supabase
    .from("poll_templates")
    .insert({
      account_id: input.accountId,
      title: input.title,
      description: input.description,
      selection_mode: input.selectionMode,
      is_active: true,
      sort_order: nextSortOrder,
      created_by: input.createdBy,
    })
    .select("id, account_id, title, description, selection_mode, is_active, sort_order, created_by, created_at, updated_at")
    .single();

  throwIfError(error);
  return data as PollTemplate;
}

export async function updatePollTemplate(input: UpdatePollTemplateInput) {
  const { error } = await supabase
    .from("poll_templates")
    .update({
      title: input.title,
      description: input.description,
      selection_mode: input.selectionMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.pollTemplateId);

  throwIfError(error);
}

export async function archivePollTemplate(pollTemplateId: string) {
  const { error } = await supabase
    .from("poll_templates")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pollTemplateId);

  throwIfError(error);
}

export async function deleteSportModality(modalityId: string) {
  const { error } = await supabase.from("sport_modalities").delete().eq("id", modalityId);

  throwIfError(error);
}

export async function deleteSportsAccount(accountId: string) {
  const { error } = await supabase.from("sports_accounts").delete().eq("id", accountId);

  throwIfError(error);
}

export async function upsertAccountMembership(input: {
  accountId: string;
  profileId: string;
  accountPlayerId?: string | null;
  role: AccountRole;
  priorityGroupId: string | null;
}) {
  const { error } = await supabase.from("account_memberships").upsert(
    {
      account_id: input.accountId,
      profile_id: input.profileId,
      account_player_id: input.accountPlayerId ?? null,
      role: input.role,
      priority_group_id: input.priorityGroupId,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "account_id,profile_id",
    },
  );

  throwIfError(error);
}

export async function deactivateAccountMembership(membershipId: string) {
  const { error } = await supabase
    .from("account_memberships")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  throwIfError(error);
}

export async function updateProfileBasics(input: {
  profileId: string;
  fullName: string;
}) {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.profileId);

  throwIfError(error);
}

export async function replaceMembershipPositionPreferences(
  membershipId: string,
  orderedPositionIds: string[],
) {
  const uniqueOrderedPositionIds = [...new Set(orderedPositionIds)];

  const { error: deleteError } = await supabase
    .from("membership_position_preferences")
    .delete()
    .eq("membership_id", membershipId);

  throwIfError(deleteError);

  if (uniqueOrderedPositionIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("membership_position_preferences").insert(
    uniqueOrderedPositionIds.map((positionId, index) => ({
      membership_id: membershipId,
      modality_position_id: positionId,
      preference_order: index + 1,
    })),
  );

  throwIfError(insertError);
}
