import React from 'react';
import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';
import Spinner from '@/components/elements/Spinner';

interface Props {
    isLoading?: boolean;
    size?: 'xsmall' | 'small' | 'large' | 'xlarge';
    color?: 'green' | 'red' | 'primary' | 'grey';
    isSecondary?: boolean;
}

const ButtonStyle = styled.button.attrs({ className: 'rock-button' as string })<Omit<Props, 'isLoading'>>`
    ${tw`relative inline-block p-2 uppercase tracking-wide text-sm transition-all duration-150 border overflow-hidden`};
    border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transform: translateZ(0);

    &::before {
        position: absolute;
        top: 0;
        bottom: 0;
        left: -75%;
        width: 42%;
        content: '';
        pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transform: skewX(-20deg);
        transition: left 520ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    &:hover:not(:disabled) {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 10px 28px rgba(0, 0, 0, 0.16);
    }

    @media (hover: hover) and (pointer: fine) {
        &:hover:not(:disabled) {
            transform: translateY(-1px);
        }

        &:hover:not(:disabled)::before {
            left: 135%;
        }
    }

    & > span {
        position: relative;
        z-index: 1;
    }

    ${(props) =>
        ((!props.isSecondary && !props.color) || props.color === 'primary') &&
        css<Props>`
            ${(props) => !props.isSecondary && tw`bg-primary-700 border-primary-800 border text-primary-50`};
            background-image: linear-gradient(135deg, rgba(var(--shell-accent-rgb), 0.18), transparent 48%);

            &:hover:not(:disabled) {
                ${tw`bg-primary-800 border-primary-900`};
            }
        `};

    ${(props) =>
        props.color === 'grey' &&
        css`
            ${tw`border-neutral-600 bg-neutral-500 text-neutral-50`};

            &:hover:not(:disabled) {
                ${tw`bg-neutral-600 border-neutral-700`};
            }
        `};

    ${(props) =>
        props.color === 'green' &&
        css<Props>`
            ${tw`border-green-600 bg-green-500 text-green-50`};

            &:hover:not(:disabled) {
                ${tw`bg-green-600 border-green-700`};
            }

            ${(props) =>
                props.isSecondary &&
                css`
                    &:active:not(:disabled) {
                        ${tw`bg-green-600 border-green-700`};
                    }
                `};
        `};

    ${(props) =>
        props.color === 'red' &&
        css<Props>`
            ${tw`border-red-600 bg-red-500 text-red-50`};

            &:hover:not(:disabled) {
                ${tw`bg-red-600 border-red-700`};
            }

            ${(props) =>
                props.isSecondary &&
                css`
                    &:active:not(:disabled) {
                        ${tw`bg-red-600 border-red-700`};
                    }
                `};
        `};

    ${(props) => props.size === 'xsmall' && tw`px-2 py-1 text-xs`};
    ${(props) => (!props.size || props.size === 'small') && tw`px-4 py-2`};
    ${(props) => props.size === 'large' && tw`p-4 text-sm`};
    ${(props) => props.size === 'xlarge' && tw`p-4 w-full`};

    ${(props) =>
        props.isSecondary &&
        css<Props>`
            ${tw`border-neutral-600 bg-transparent text-neutral-200`};

            &:hover:not(:disabled) {
                ${tw`border-neutral-500 text-neutral-100`};
                ${(props) => props.color === 'red' && tw`bg-red-500 border-red-600 text-red-50`};
                ${(props) => props.color === 'primary' && tw`bg-primary-700 border-primary-800 text-primary-50`};
                ${(props) => props.color === 'green' && tw`bg-green-500 border-green-600 text-green-50`};
            }
        `};

    &:disabled {
        opacity: 0.55;
        cursor: default;
        transform: none;
    }
`;

type ComponentProps = Omit<JSX.IntrinsicElements['button'], 'ref' | keyof Props> & Props;

const Button: React.FC<ComponentProps> = ({ children, isLoading, ...props }) => (
    <ButtonStyle {...props}>
        {isLoading && (
            <div css={tw`flex absolute justify-center items-center w-full h-full left-0 top-0`}>
                <Spinner size={'small'} />
            </div>
        )}
        <span css={isLoading ? tw`text-transparent` : undefined}>{children}</span>
    </ButtonStyle>
);

type LinkProps = Omit<JSX.IntrinsicElements['a'], 'ref' | keyof Props> & Props;

const LinkButton: React.FC<LinkProps> = (props) => <ButtonStyle as={'a'} {...props} />;

export { LinkButton, ButtonStyle };
export default Button;
