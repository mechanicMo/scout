import {
  assertEquals,
  assert,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Admin client for user creation/deletion and cleanup
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Test user credentials (created fresh for each test)
let testUserA: { id: string; email: string } | null = null;
let testUserB: { id: string; email: string } | null = null;
let anonUserClient: ReturnType<typeof createClient> | null = null;
let aUserClient: ReturnType<typeof createClient> | null = null;
let bUserClient: ReturnType<typeof createClient> | null = null;

// Helper function to create test user
async function createTestUser(email: string): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: "Test123!@#",
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user ${email}: ${error.message}`);
  }

  if (!data.user?.id) {
    throw new Error(`No user ID returned for ${email}`);
  }

  return data.user.id;
}

// Helper function to delete test user
async function deleteTestUser(userId: string): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId);
}

// Helper function to create authenticated client for a user
function createAuthenticatedClient(
  session: any
): ReturnType<typeof createClient> {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });
}

// Test setup
async function setup(): Promise<void> {
  console.log("Setting up test users...");

  // Create test users
  testUserA = {
    id: await createTestUser(`testa-${Date.now()}@example.com`),
    email: `testa-${Date.now()}@example.com`,
  };

  testUserB = {
    id: await createTestUser(`testb-${Date.now()}@example.com`),
    email: `testb-${Date.now()}@example.com`,
  };

  console.log(`Created test user A: ${testUserA.id}`);
  console.log(`Created test user B: ${testUserB.id}`);

  // Sign in as user A
  const { data: sessionA, error: errorA } = await adminClient.auth
    .signInWithPassword({
      email: testUserA.email,
      password: "Test123!@#",
    });

  if (errorA || !sessionA.session) {
    throw new Error(`Failed to sign in as user A: ${errorA?.message}`);
  }

  aUserClient = createAuthenticatedClient(sessionA.session);

  // Sign in as user B
  const { data: sessionB, error: errorB } = await adminClient.auth
    .signInWithPassword({
      email: testUserB.email,
      password: "Test123!@#",
    });

  if (errorB || !sessionB.session) {
    throw new Error(`Failed to sign in as user B: ${errorB?.message}`);
  }

  bUserClient = createAuthenticatedClient(sessionB.session);

  // Create anon client for public access tests
  anonUserClient = createClient(SUPABASE_URL, ANON_KEY);

  console.log("Setup complete");
}

// Test teardown
async function teardown(): Promise<void> {
  console.log("Cleaning up test users...");

  if (testUserA) {
    await deleteTestUser(testUserA.id);
  }

  if (testUserB) {
    await deleteTestUser(testUserB.id);
  }

  console.log("Cleanup complete");
}

// RLS Tests
Deno.test("RLS: user A cannot read user B watchlist", async () => {
  if (!aUserClient || !bUserClient || !testUserA || !testUserB) {
    throw new Error("Test setup failed");
  }

  // User B inserts a watchlist item
  const { data: insertData, error: insertError } = await bUserClient
    .from("watchlist")
    .insert({
      user_id: testUserB.id,
      media_id: "test-media-123",
      added_at: new Date().toISOString(),
    })
    .select();

  if (insertError) {
    throw new Error(`User B failed to insert watchlist: ${insertError.message}`);
  }

  // User A attempts to read user B's watchlist
  const { data: readData, error: readError } = await aUserClient
    .from("watchlist")
    .select()
    .eq("user_id", testUserB.id);

  // RLS should prevent reading another user's data
  if (readError) {
    // Error is expected - RLS blocked the read
    assertEquals(readData?.length || 0, 0, "User A should not see User B's data");
  } else {
    // If no error, data should be empty (RLS filtered it out)
    assertEquals(readData?.length || 0, 0, "User A's query should return empty");
  }
});

Deno.test(
  "RLS: user cannot insert watchlist for another user",
  async () => {
    if (!aUserClient || !testUserA || !testUserB) {
      throw new Error("Test setup failed");
    }

    // User A attempts to insert a watchlist item for User B
    const { error } = await aUserClient
      .from("watchlist")
      .insert({
        user_id: testUserB.id, // Inserting for a different user
        media_id: "test-media-456",
        added_at: new Date().toISOString(),
      });

    // RLS should prevent this insert
    assert(error !== null, "Insert for another user should be blocked by RLS");
    assert(
      error.message.includes("violates row level security policy") ||
        error.message.includes("policy"),
      `Error should mention RLS policy: ${error.message}`
    );
  }
);

Deno.test(
  "RLS: authenticated user can read media_cache",
  async () => {
    if (!aUserClient || !bUserClient || !testUserA || !testUserB) {
      throw new Error("Test setup failed");
    }

    // Admin inserts a media item (globally readable)
    const { error: insertError } = await adminClient
      .from("media_cache")
      .insert({
        media_id: `test-media-${Date.now()}`,
        title: "Test Movie",
        media_type: "movie",
        tmdb_id: 12345,
        data: { overview: "A test movie" },
      })
      .select();

    if (insertError) {
      throw new Error(
        `Failed to insert media_cache: ${insertError.message}`
      );
    }

    // Both users should be able to read (no row-level restrictions)
    const { data: dataA, error: errorA } = await aUserClient
      .from("media_cache")
      .select()
      .limit(1);

    const { data: dataB, error: errorB } = await bUserClient
      .from("media_cache")
      .select()
      .limit(1);

    assert(
      !errorA,
      `User A should be able to read media_cache: ${errorA?.message}`
    );
    assert(
      !errorB,
      `User B should be able to read media_cache: ${errorB?.message}`
    );
    assert(
      (dataA?.length || 0) > 0,
      "User A should see at least one media_cache entry"
    );
    assert(
      (dataB?.length || 0) > 0,
      "User B should see at least one media_cache entry"
    );
  }
);

Deno.test("RLS: user A can only read their own watchlist", async () => {
  if (!aUserClient || !testUserA) {
    throw new Error("Test setup failed");
  }

  // User A inserts their own watchlist item
  const { error: insertError } = await aUserClient
    .from("watchlist")
    .insert({
      user_id: testUserA.id,
      media_id: "user-a-media",
      added_at: new Date().toISOString(),
    })
    .select();

  if (insertError) {
    throw new Error(`User A failed to insert: ${insertError.message}`);
  }

  // User A reads their own watchlist
  const { data, error } = await aUserClient
    .from("watchlist")
    .select()
    .eq("user_id", testUserA.id);

  assert(!error, `User A should be able to read their own data: ${error?.message}`);
  assert(
    (data?.length || 0) > 0,
    "User A should see their own watchlist items"
  );
  assertEquals(data?.[0]?.user_id, testUserA.id, "Returned item should belong to User A");
});

Deno.test(
  "RLS: user can only insert watchlist with their own user_id",
  async () => {
    if (!aUserClient || !testUserA) {
      throw new Error("Test setup failed");
    }

    // User A inserts a watchlist item with their own user_id
    const { error } = await aUserClient
      .from("watchlist")
      .insert({
        user_id: testUserA.id,
        media_id: "another-media",
        added_at: new Date().toISOString(),
      });

    assert(
      !error,
      `User A should be able to insert with their own user_id: ${error?.message}`
    );
  }
);

// Run all tests
if (import.meta.main) {
  await setup();

  try {
    // Tests will run automatically
    console.log("Running RLS tests...");
  } finally {
    await teardown();
  }
}
