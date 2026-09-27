import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import NavigationIcon from './NavigationIcon';
import { AmbientCursor, BorderGlow, TiltSpotlight } from './ReactBitsEffects';
import { MagicBentoCard } from './reactbits/MagicBento';

describe('matte workspace surfaces', () => {
    it('retains functional interaction without generating decorative layers', () => {
        const onClick = jest.fn();
        const { getByText, container } = render(
            <MagicBentoCard enableStars enableTilt clickEffect onClick={onClick}>
                <TiltSpotlight>
                    <BorderGlow>Open server</BorderGlow>
                </TiltSpotlight>
                <AmbientCursor />
            </MagicBentoCard>
        );
        fireEvent.click(getByText('Open server'));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(container.querySelectorAll('canvas, .magic-bento-particle, .rb-ambient-cursor')).toHaveLength(0);
    });

    it.each([
        ['Account', 'users'],
        ['API Credentials', 'api'],
        ['Files', 'files'],
        ['unknown', 'overview'],
    ])('maps %s to the %s outline icon', (name, icon) => {
        const { container } = render(<NavigationIcon name={name} />);
        expect(container.querySelector('use')?.getAttribute('href')).toBe(
            `/themes/pterodactyl/icons/navigation.svg#${icon}`
        );
    });
});
