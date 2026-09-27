<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\View\View;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Helpers\SoftwareVersionService;

class BaseController extends Controller
{
    /**
     * BaseController constructor.
     */
    public function __construct(private SoftwareVersionService $version)
    {
    }

    /**
     * Return the admin index view.
     */
    public function index(): View
    {
        return view('admin.index', [
            'version' => $this->version,
            'counts' => [
                'servers' => \Pterodactyl\Models\Server::count(),
                'nodes' => \Pterodactyl\Models\Node::count(),
                'users' => \Pterodactyl\Models\User::count(),
                'locations' => \Pterodactyl\Models\Location::count(),
            ],
            'recentServers' => \Pterodactyl\Models\Server::with('node')->latest('id')->limit(5)->get(),
        ]);
    }
}
