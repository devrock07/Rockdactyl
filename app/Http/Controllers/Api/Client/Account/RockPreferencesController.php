<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Account;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class RockPreferencesController extends ClientApiController
{
    public function index(Request $request): JsonResponse
    {
        $preferences = null;
        $preferencesAvailable = false;
        $notifications = collect();
        $notificationsAvailable = false;

        try {
            if (Schema::hasTable('rock_user_preferences')) {
                $preferences = DB::table('rock_user_preferences')
                    ->where('user_id', $request->user()->id)
                    ->value('server_preferences');
                $preferencesAvailable = true;
            }
        } catch (\Throwable) {
            // The client keeps a local copy of preferences while storage is unavailable.
        }

        try {
            if (Schema::hasTable('rock_notifications')) {
                $notifications = DB::table('rock_notifications')
                    ->where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->latest()->limit(30)->get()
                    ->map(fn ($item) => [
                        'id' => (string) $item->id,
                        'type' => $item->type,
                        'title' => $item->title,
                        'message' => $item->message,
                        'href' => $item->href,
                        'readAt' => $item->read_at,
                        'createdAt' => $item->created_at,
                    ]);
                $notificationsAvailable = true;
            }
        } catch (\Throwable) {
            // The availability flag prevents a transient failure from looking like an authoritative empty inbox.
        }

        return response()->json([
            'serverPreferences' => $preferences ? json_decode($preferences, true) : new \stdClass(),
            'preferencesAvailable' => $preferencesAvailable,
            'notifications' => $notifications,
            'notificationsAvailable' => $notificationsAvailable,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'server_preferences' => ['present', 'array'],
            'server_preferences.*' => ['array'],
            'server_preferences.*.favorite' => ['sometimes', 'boolean'],
            'server_preferences.*.group' => ['sometimes', 'nullable', 'string', 'max:32'],
        ]);

        // Laravel converts empty input strings to null before validation.
        // Keep the client contract stable for ungrouped and favorite-only entries.
        $data['server_preferences'] = array_map(fn (array $preference) => [
            'favorite' => (bool) ($preference['favorite'] ?? false),
            'group' => $preference['group'] ?? '',
        ], $data['server_preferences']);

        try {
            if (!Schema::hasTable('rock_user_preferences')) {
                return $this->preferenceStorageUnavailable();
            }

            DB::table('rock_user_preferences')->upsert(
                [[
                    'user_id' => $request->user()->id,
                    'server_preferences' => json_encode($data['server_preferences']),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]],
                ['user_id'],
                ['server_preferences', 'updated_at']
            );
        } catch (\Throwable) {
            return $this->preferenceStorageUnavailable();
        }

        return response()->json(['serverPreferences' => $data['server_preferences']]);
    }

    public function clearNotifications(Request $request): JsonResponse
    {
        try {
            if (!Schema::hasTable('rock_notifications')) {
                return $this->notificationStorageUnavailable();
            }

            DB::table('rock_notifications')
                ->where('user_id', $request->user()->id)
                ->whereNull('read_at')
                ->update(['read_at' => now(), 'updated_at' => now()]);
        } catch (\Throwable) {
            return $this->notificationStorageUnavailable();
        }

        return response()->json([], 204);
    }

    public function markNotificationRead(Request $request, string $notification): JsonResponse
    {
        if (!ctype_digit($notification)) {
            return response()->json([], 204);
        }

        try {
            if (!Schema::hasTable('rock_notifications')) {
                return $this->notificationStorageUnavailable();
            }

            DB::table('rock_notifications')
                ->where('id', $notification)
                ->where('user_id', $request->user()->id)
                ->whereNull('read_at')
                ->update(['read_at' => now(), 'updated_at' => now()]);
        } catch (\Throwable) {
            return $this->notificationStorageUnavailable();
        }

        return response()->json([], 204);
    }

    private function notificationStorageUnavailable(): JsonResponse
    {
        return response()->json([
            'message' => 'Notification storage is temporarily unavailable. Please retry.',
        ], 503)->header('Retry-After', '5');
    }

    private function preferenceStorageUnavailable(): JsonResponse
    {
        return response()->json([
            'message' => 'Preference storage is temporarily unavailable. Please retry.',
        ], 503)->header('Retry-After', '5');
    }
}
