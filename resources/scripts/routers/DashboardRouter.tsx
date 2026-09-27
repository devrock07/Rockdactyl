import React from 'react';
import { NavLink, Route, Switch } from 'react-router-dom';
import NavigationBar from '@/components/NavigationBar';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';
import routes from '@/routers/routes';
import Sidebar from '@/components/Sidebar';
import NavigationIcon from '@/components/elements/NavigationIcon';

import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import MobileBottomNav from '@/components/MobileBottomNav';
import AnnouncementBanner from '@/components/elements/AnnouncementBanner';

export default () => {
    const location = useLocation();
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);

    return (
        <>
            <NavigationBar />
            <div className={'content-container'}>
                <AnnouncementBanner />
            </div>
            <Sidebar>
                <div className={'sidebar-section'}>Workspace</div>
                <NavLink to={'/'} exact>
                    <div className='icon'>
                        <NavigationIcon name={'servers'} />
                    </div>
                    Servers
                </NavLink>
                <div className={'sidebar-section'}>Account</div>
                {routes.account
                    .filter((route) => !!route.name)
                    .map(({ path, name, exact = false }) => (
                        <NavLink key={path} to={`/account/${path}`.replace('//', '/')} exact={exact}>
                            <div className='icon'>
                                <NavigationIcon name={name} />
                            </div>
                            {name}
                        </NavLink>
                    ))}
                {rootAdmin && (
                    <>
                        <div className={'sidebar-section'}>Administration</div>
                        <a href={'/admin'}>
                            <div className='icon'>
                                <NavigationIcon name={'admin'} />
                            </div>
                            Admin panel
                        </a>
                    </>
                )}
            </Sidebar>
            <MobileBottomNav />

            <TransitionRouter>
                <React.Suspense fallback={<Spinner centered />}>
                    <Switch location={location}>
                        <Route path={'/'} exact>
                            <DashboardContainer />
                        </Route>
                        {routes.account.map(({ path, component: Component }) => (
                            <Route key={path} path={`/account/${path}`.replace('//', '/')} exact>
                                <Component />
                            </Route>
                        ))}
                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </React.Suspense>
            </TransitionRouter>
        </>
    );
};
