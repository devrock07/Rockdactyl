import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { CopyCommand } from '@/components/copy-command';
import { PanelScreenshot } from '@/components/panel-screenshot';
import { ScrollHeaderState } from '@/components/scroll-header-state';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { releaseUrl } from '@/lib/docs';
import { withBasePath } from '@/lib/site';

export const metadata: Metadata = {
    title: 'Rockdactyl — UI mod for Pterodactyl',
    description: 'A responsive interface mod for Pterodactyl Panel.',
};

const releaseVersion = '3.0.0';

const installCommand = `curl -fsSL https://raw.githubusercontent.com/devrock07/Rockdactyl/main/install.sh \\
  -o /tmp/rockdactyl-install.sh
sudo bash /tmp/rockdactyl-install.sh install`;

const coverage = [
    {
        area: 'Client area',
        detail: 'Dashboard, account, API credentials, SSH keys and activity',
    },
    {
        area: 'Server controls',
        detail: 'Console, files, databases, schedules, backups and networking',
    },
    {
        area: 'Administration',
        detail: 'Settings, nodes, locations, mounts, nests, users and servers',
    },
    {
        area: 'Public pages',
        detail: 'Authentication, error states and service status',
    },
] as const;

export default function Home() {
    return (
        <div className="site-shell min-h-screen text-foreground">
            <SiteHeader />
            <ScrollHeaderState />

            <main id="main-content">
                <section className="landing-hero">
                    <div className="page-frame hero-layout">
                        <div className="hero-copy">
                            <p className="section-index">
                                Interface mod for Pterodactyl
                            </p>
                            <h1 className="hero-title">
                                A complete UI mod
                                <span> for Pterodactyl.</span>
                            </h1>
                            <p className="hero-summary">
                                Rockdactyl redraws the panel&apos;s client,
                                server, and admin interfaces without changing
                                the workflow underneath.
                            </p>
                            <div className="hero-actions">
                                <Link
                                    className="primary-link"
                                    href="/docs/installation"
                                >
                                    Install Rockdactyl{' '}
                                    <span aria-hidden="true">→</span>
                                </Link>
                                <Link className="text-link" href="/docs">
                                    Documentation{' '}
                                    <span aria-hidden="true">↗</span>
                                </Link>
                            </div>
                        </div>

                        <dl className="hero-facts">
                            <div>
                                <dt>Current</dt>
                                <dd>{releaseVersion}</dd>
                            </div>
                            <div>
                                <dt>Panel</dt>
                                <dd>1.15.1</dd>
                            </div>
                            <div>
                                <dt>Source</dt>
                                <dd>
                                    <Link href={releaseUrl}>
                                        Release notes ↗
                                    </Link>
                                </dd>
                            </div>
                        </dl>

                        <div className="hero-product">
                            <PanelScreenshot
                                src="/screenshots/dashboard-crimson.webp"
                                alt="Rockdactyl dashboard showing the client navigation and server cards"
                                label="Rockdactyl client dashboard"
                                priority
                            />
                            <div className="product-caption" aria-hidden="true">
                                <span>01 / Client dashboard</span>
                                <span>Rockdactyl {releaseVersion}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="screens" className="section-block">
                    <div className="page-frame">
                        <header className="section-heading">
                            <p className="section-index">01 / Daily use</p>
                            <h2>A theme should hold up on the busy screens.</h2>
                            <p>
                                The console is dense by nature. Rockdactyl gives
                                the output, telemetry, and actions a clear order
                                instead of hiding them behind decoration.
                            </p>
                        </header>

                        <div className="console-layout">
                            <div className="console-notes">
                                <p className="note-lead">Server console</p>
                                <ol>
                                    <li>
                                        <span>01</span>
                                        Terminal output remains the visual
                                        focus.
                                    </li>
                                    <li>
                                        <span>02</span>
                                        Resource data stays readable at a
                                        glance.
                                    </li>
                                    <li>
                                        <span>03</span>
                                        Primary controls keep predictable
                                        positions.
                                    </li>
                                </ol>
                            </div>
                            <PanelScreenshot
                                src="/screenshots/console.webp"
                                alt="Rockdactyl server console with resource telemetry and navigation"
                                label="Server console"
                            />
                        </div>
                    </div>
                </section>

                <section
                    id="responsive"
                    className="section-block section-muted"
                >
                    <div className="page-frame responsive-layout">
                        <div className="responsive-copy">
                            <p className="section-index">02 / Responsive</p>
                            <h2>The same panel, composed for mobile.</h2>
                            <p>
                                Navigation, server cards, dialogs, and controls
                                are rearranged for narrow screens. Nothing is
                                presented as a miniature desktop page.
                            </p>
                            <dl className="responsive-facts">
                                <div>
                                    <dt>Mobile target</dt>
                                    <dd>390 px</dd>
                                </div>
                                <div>
                                    <dt>Coverage</dt>
                                    <dd>Client + server</dd>
                                </div>
                            </dl>
                        </div>

                        <figure className="phone-frame">
                            <Image
                                src={withBasePath(
                                    '/screenshots/mobile-dashboard.webp',
                                )}
                                alt="Rockdactyl client dashboard on a mobile screen"
                                width={390}
                                height={844}
                                sizes="(max-width: 720px) 74vw, 310px"
                                loading="eager"
                                className="phone-image"
                            />
                        </figure>

                        <div className="status-preview">
                            <div className="product-caption" aria-hidden="true">
                                <span>Public status</span>
                                <span>Same visual system</span>
                            </div>
                            <PanelScreenshot
                                src="/screenshots/status.webp"
                                alt="Rockdactyl public service status page"
                                label="Public service status"
                            />
                        </div>
                    </div>
                </section>

                <section id="features" className="section-block">
                    <div className="page-frame coverage-layout">
                        <header className="coverage-heading">
                            <p className="section-index">03 / Coverage</p>
                            <h2>Designed past the dashboard.</h2>
                            <p>
                                The visual system follows you into the practical
                                parts of Pterodactyl—not only the screen used
                                for screenshots.
                            </p>
                        </header>

                        <div className="coverage-list">
                            {coverage.map((item, index) => (
                                <div key={item.area} className="coverage-row">
                                    <span>
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <strong>{item.area}</strong>
                                    <p>{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="install" className="section-block install-section">
                    <div className="page-frame install-layout">
                        <div className="install-copy">
                            <p className="section-index">04 / Installation</p>
                            <h2>Install from a release, with a way back.</h2>
                            <p>
                                The manager checks the package, takes a rollback
                                snapshot, and then applies the interface files.
                            </p>
                            <Link
                                className="text-link"
                                href="/docs/installation"
                            >
                                Read the complete guide{' '}
                                <span aria-hidden="true">→</span>
                            </Link>
                        </div>

                        <div className="install-terminal">
                            <div className="terminal-bar">
                                <span>shell / install</span>
                                <CopyCommand value={installCommand} />
                            </div>
                            <pre>
                                <code>{installCommand}</code>
                            </pre>
                            <p className="terminal-note">
                                Checksum verified before panel files change.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
}
