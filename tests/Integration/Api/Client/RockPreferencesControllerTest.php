<?php

namespace Pterodactyl\Tests\Integration\Api\Client;

use Pterodactyl\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RockPreferencesControllerTest extends ClientApiIntegrationTestCase
{
    public function testUngroupedFavoritesAndEmptyPreferencesCanBeSaved(): void
    {
        $user = User::factory()->create();
        foreach (['', null] as $group) {
            $this->actingAs($user)
                ->putJson('/api/client/account/rock', [
                    'server_preferences' => ['server-id' => ['favorite' => true, 'group' => $group]],
                ])
                ->assertOk()
                ->assertJsonPath('serverPreferences.server-id.group', '')
                ->assertJsonPath('serverPreferences.server-id.favorite', true);
        }
        $this->actingAs($user)
            ->putJson('/api/client/account/rock', ['server_preferences' => []])
            ->assertOk();
        $stored = DB::table('rock_user_preferences')->where('user_id', $user->id)->value('server_preferences');
        $this->assertSame([], json_decode($stored, true));
        $this->actingAs($user)->putJson('/api/client/account/rock', [])->assertStatus(422);
    }

    public function testServerPreferencesArePersisted(): void
    {
        $user = User::factory()->create();
        $preferences = [
            'server-id' => ['favorite' => true, 'group' => 'Production'],
        ];

        $this->actingAs($user)
            ->putJson('/api/client/account/rock', ['server_preferences' => $preferences])
            ->assertOk()
            ->assertJsonPath('serverPreferences.server-id.group', 'Production');

        $stored = DB::table('rock_user_preferences')->where('user_id', $user->id)->value('server_preferences');
        $this->assertEquals($preferences, json_decode($stored, true));
        $this->actingAs($user)
            ->getJson('/api/client/account/rock')
            ->assertJsonPath('preferencesAvailable', true)
            ->assertJsonPath('serverPreferences.server-id.favorite', true);
    }

    public function testPreferenceUpdateReturnsRetryableFailureWhenStorageIsUnavailable(): void
    {
        $user = User::factory()->create();
        Schema::partialMock()
            ->shouldReceive('hasTable')
            ->with('rock_user_preferences')
            ->andReturn(false);

        $this->actingAs($user)
            ->putJson('/api/client/account/rock', [
                'server_preferences' => ['server-id' => ['favorite' => true, 'group' => 'Test']],
            ])
            ->assertStatus(503)
            ->assertHeader('Retry-After', '5');
    }

    public function testIndexDistinguishesUnavailablePreferenceStorageFromEmptyPreferences(): void
    {
        $user = User::factory()->create();
        Schema::partialMock()
            ->shouldReceive('hasTable')
            ->with('rock_user_preferences')
            ->andReturn(false);

        $this->actingAs($user)
            ->getJson('/api/client/account/rock')
            ->assertOk()
            ->assertJsonPath('preferencesAvailable', false);
    }

    public function testOnlyUnreadNotificationsAreReturned(): void
    {
        $user = User::factory()->create();
        $unread = $this->createNotification($user, 'Unread alert');
        $this->createNotification($user, 'Read alert', now());

        $response = $this->actingAs($user)->getJson('/api/client/account/rock');

        $response->assertOk();
        $response->assertJsonPath('notificationsAvailable', true);
        $response->assertJsonCount(1, 'notifications');
        $response->assertJsonPath('notifications.0.id', (string) $unread);
        $response->assertJsonPath('notifications.0.title', 'Unread alert');
    }

    public function testNotificationCanOnlyBeMarkedReadByItsOwner(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $notification = $this->createNotification($user, 'Owned alert');
        $otherNotification = $this->createNotification($other, 'Other alert');

        $this->actingAs($user)
            ->patchJson("/api/client/account/rock/notifications/{$notification}/read")
            ->assertNoContent();
        $this->actingAs($user)
            ->patchJson("/api/client/account/rock/notifications/{$otherNotification}/read")
            ->assertNoContent();

        $this->assertNotNull(DB::table('rock_notifications')->where('id', $notification)->value('read_at'));
        $this->assertNull(DB::table('rock_notifications')->where('id', $otherNotification)->value('read_at'));
        $this->actingAs($user)->getJson('/api/client/account/rock')->assertJsonCount(0, 'notifications');
    }

    public function testClearingNotificationsMarksAllUnreadRowsAsRead(): void
    {
        $user = User::factory()->create();
        $this->createNotification($user, 'First alert');
        $this->createNotification($user, 'Second alert');

        $this->actingAs($user)->deleteJson('/api/client/account/rock/notifications')->assertNoContent();

        $this->assertSame(
            0,
            DB::table('rock_notifications')->where('user_id', $user->id)->whereNull('read_at')->count()
        );
    }

    public function testIndexDistinguishesUnavailableNotificationStorageFromAnEmptyInbox(): void
    {
        $user = User::factory()->create();
        Schema::partialMock()
            ->shouldReceive('hasTable')
            ->with('rock_notifications')
            ->andReturn(false);

        $response = $this->actingAs($user)->getJson('/api/client/account/rock');

        $response->assertOk();
        $response->assertJsonPath('notificationsAvailable', false);
        $response->assertJsonCount(0, 'notifications');
    }

    public function testNotificationMutationsReturnRetryableFailureWhenStorageIsUnavailable(): void
    {
        $user = User::factory()->create();
        Schema::partialMock()
            ->shouldReceive('hasTable')
            ->with('rock_notifications')
            ->andReturn(false);

        $this->actingAs($user)
            ->patchJson('/api/client/account/rock/notifications/42/read')
            ->assertStatus(503)
            ->assertHeader('Retry-After', '5');
        $this->actingAs($user)
            ->deleteJson('/api/client/account/rock/notifications')
            ->assertStatus(503)
            ->assertHeader('Retry-After', '5');
    }

    private function createNotification(User $user, string $title, mixed $readAt = null): int
    {
        return DB::table('rock_notifications')->insertGetId([
            'user_id' => $user->id,
            'server_id' => null,
            'type' => 'recovered',
            'title' => $title,
            'message' => 'The server is responding again.',
            'href' => '/',
            'read_at' => $readAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
