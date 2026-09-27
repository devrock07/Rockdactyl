import {
    Chart as ChartJS,
    ChartData,
    ChartDataset,
    ChartOptions,
    Filler,
    LinearScale,
    LineElement,
    PointElement,
} from 'chart.js';
import { DeepPartial } from 'ts-essentials';
import { useEffect, useState } from 'react';
import { deepmerge, deepmergeCustom } from 'deepmerge-ts';
import { theme } from 'twin.macro';
import { hexToRgba } from '@/lib/helpers';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

ChartJS.register(LineElement, PointElement, Filler, LinearScale);

const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: 1.5,
    events: [],
    animation: false,
    plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: { enabled: false },
    },
    layout: {
        padding: 0,
    },
    scales: {
        x: {
            min: 0,
            max: 19,
            type: 'linear',
            grid: {
                display: false,
                drawBorder: false,
            },
            ticks: {
                display: false,
            },
        },
        y: {
            min: 0,
            type: 'linear',
            grid: {
                display: true,
                color: 'rgba(160, 170, 185, 0.12)',
                drawBorder: false,
            },
            ticks: {
                display: true,
                count: 3,
                color: theme('colors.gray.200'),
                font: {
                    family: theme('fontFamily.sans'),
                    size: 11,
                    weight: '400',
                },
            },
        },
    },
    elements: {
        point: {
            radius: 0,
        },
        line: {
            tension: 0.28,
            borderWidth: 2,
        },
    },
};

function getOptions(opts?: DeepPartial<ChartOptions<'line'>> | undefined): ChartOptions<'line'> {
    return deepmerge(options, opts || {});
}

export interface ChartPalette {
    300: string;
    400: string;
    500: string;
    700: string;
    800: string;
}

const crimsonPalette: ChartPalette = {
    300: '#fda4af',
    400: '#f08a90',
    500: '#d96069',
    700: '#a52f3d',
    800: '#7f1d2d',
};

const bluePalette: ChartPalette = {
    300: '#9bbcff',
    400: '#7ea5ff',
    500: '#5b8cff',
    700: '#3152b0',
    800: '#1f3a80',
};

type ChartDatasetCallback = (value: ChartDataset<'line'>, index: number, palette: ChartPalette) => ChartDataset<'line'>;

function getEmptyData(
    label: string,
    sets = 1,
    callback?: ChartDatasetCallback | undefined,
    palette: ChartPalette = crimsonPalette
): ChartData<'line'> {
    const next = callback || ((value) => value);

    return {
        labels: Array(20)
            .fill(0)
            .map((_, index) => index),
        datasets: Array(sets)
            .fill(0)
            .map((_, index) =>
                next(
                    {
                        fill: true,
                        label,
                        data: Array(20).fill(-5),
                        borderColor: palette[400],
                        backgroundColor: hexToRgba(palette[700], 0.12),
                    },
                    index,
                    palette
                )
            ),
    };
}

const merge = deepmergeCustom({ mergeArrays: false });

interface UseChartOptions {
    sets: number;
    options?: DeepPartial<ChartOptions<'line'>> | number | undefined;
    callback?: ChartDatasetCallback | undefined;
}

function useChart(label: string, opts?: UseChartOptions) {
    const blue = useStoreState((state: ApplicationStore) => state.settings.data?.branding.themePreset === 'blue');
    const palette = blue ? bluePalette : crimsonPalette;
    const options = getOptions(
        typeof opts?.options === 'number' ? { scales: { y: { min: 0, suggestedMax: opts.options } } } : opts?.options
    );
    const [data, setData] = useState(getEmptyData(label, opts?.sets || 1, opts?.callback, palette));

    useEffect(() => {
        setData((state) => ({
            ...state,
            datasets: state.datasets.map((dataset, index) =>
                (opts?.callback || ((value) => value))(
                    {
                        ...dataset,
                        borderColor: palette[400],
                        backgroundColor: hexToRgba(palette[700], 0.12),
                    },
                    index,
                    palette
                )
            ),
        }));
    }, [blue]);

    const push = (items: number | null | (number | null)[]) =>
        setData((state) =>
            merge(state, {
                datasets: (Array.isArray(items) ? items : [items]).map((item, index) => ({
                    ...state.datasets[index],
                    data: state.datasets[index].data
                        .slice(1)
                        .concat(typeof item === 'number' ? Number(item.toFixed(2)) : item),
                })),
            })
        );

    const clear = () =>
        setData((state) =>
            merge(state, {
                datasets: state.datasets.map((value) => ({
                    ...value,
                    data: Array(20).fill(-5),
                })),
            })
        );

    const replace = (items: (number | null)[][]) =>
        setData((state) => {
            const length = Math.max(20, ...items.map((values) => values.length));
            return merge(state, {
                labels: Array(length)
                    .fill(0)
                    .map((_, index) => index),
                datasets: state.datasets.map((dataset, index) => ({
                    ...dataset,
                    data: Array(Math.max(0, length - (items[index]?.length || 0)))
                        .fill(null)
                        .concat(items[index] || []),
                })),
            });
        });

    const renderedOptions = merge(options, {
        scales: {
            x: { max: Math.max(19, data.labels?.length ? data.labels.length - 1 : 19) },
            y: { grid: { color: 'rgba(160, 170, 185, 0.12)' } },
        },
    });
    return { props: { data, options: renderedOptions }, push, clear, replace };
}

function useChartTickLabel(label: string, max: number, tickLabel: string, roundTo?: number) {
    return useChart(label, {
        sets: 1,
        options: {
            scales: {
                y: {
                    suggestedMax: max,
                    ticks: {
                        callback(value) {
                            return `${roundTo ? Number(value).toFixed(roundTo) : value}${tickLabel}`;
                        },
                    },
                },
            },
        },
    });
}

export { useChart, useChartTickLabel, getOptions, getEmptyData };
