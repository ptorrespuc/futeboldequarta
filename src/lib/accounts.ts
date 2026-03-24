import { supabase } from "@/src/lib/supabase";
import type {
  AccountMembership,
  AccountPriorityGroup,
  AccountSchedule,
  ModalityPosition,
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
};

export type RosterMember = {
  membership: AccountMembership;
  profile: Profile;
  priorityGroup: AccountPriorityGroup | null;
  preferredPositions: ModalityPosition[];
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

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
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
  ]);

  throwIfError(modalityError);
  throwIfError(scheduleError);
  throwIfError(priorityGroupError);
  throwIfError(membershipError);

  return {
    account,
    modality: modalityData as SportModality,
    schedules: (scheduleData ?? []) as AccountSchedule[],
    priorityGroups: (priorityGroupData ?? []) as AccountPriorityGroup[],
    activeMemberCount: (membershipData ?? []).length,
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
      "id, account_id, profile_id, role, priority_group_id, is_active, joined_at, created_at, updated_at",
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
