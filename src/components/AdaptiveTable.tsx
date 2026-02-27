// src/components/AdaptiveTable.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveTableVariant =
    | "basic"
    | "zebra"
    | "sortablePaginated"
    | "withImages";

export type SortDirection = "asc" | "desc";

export interface AdaptiveTableColumn<T> {
    /** Unique column id */
    id: string;
    /** Column header text */
    header: string;

    /**
     * Accessor:
     * - string: key on row object
     * - function: returns cell value
     */
    accessor?: string | ((row: T) => any);

    /** Optional custom renderer */
    cell?: (row: T) => React.ReactNode;

    /** Enable sorting for this column (used in sortablePaginated variant) */
    sortable?: boolean;

    /** Alignment */
    align?: "left" | "center" | "right";

    /** Optional width */
    width?: number | string;

    /** If true, this column is the image column (used in withImages variant) */
    isImage?: boolean;

    /** Image config (used when isImage is true) */
    imageAltAccessor?: string | ((row: T) => string);
    imageSize?: number; // px (uses target_size as a baseline if not set)
    imageShape?: "square" | "circle";
}

export interface AdaptiveTableProps<T>
    extends AdaptiveComponentProps {
    variant?: AdaptiveTableVariant;

    columns: AdaptiveTableColumn<T>[];
    data: T[];

    /** Row key (recommended) */
    rowKey?: string | ((row: T, index: number) => string);

    /** Caption (accessibility) */
    caption?: string;

    /** Empty state */
    emptyMessage?: string;

    /** Visual density override; otherwise derives from ML element_spacing */
    density?: "compact" | "normal" | "spacious";

    /** Pagination (sortablePaginated) */
    pageSize?: number;

    /** Optional initial sorting (sortablePaginated) */
    initialSortColumnId?: string;
    initialSortDirection?: SortDirection;

    /** Optional table aria-label */
    ariaLabel?: string;
}

/** Helper: safe string key access */
function getValue<T>(row: T, accessor?: string | ((row: T) => any)): any {
    if (!accessor) return undefined;
    if (typeof accessor === "function") return accessor(row);
    // string accessor
    const key = accessor as any;
    return (row as any)[key];
}

function getRowKey<T>(
    row: T,
    index: number,
    rowKey?: string | ((row: T, index: number) => string)
): string {
    if (!rowKey) return String(index);
    if (typeof rowKey === "function") return rowKey(row, index);
    const k = rowKey as any;
    const v = (row as any)[k];
    if (v === undefined || v === null) return String(index);
    return String(v);
}

function clampNumber(n: number, min: number, max: number): number {
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function normalizeDensity(d?: "compact" | "normal" | "spacious"): "compact" | "normal" | "spacious" {
    if (d === "compact" || d === "spacious") return d;
    return "normal";
}

function compareValues(a: any, b: any): number {
    // Handle undefined/null
    const aU = a === undefined || a === null;
    const bU = b === undefined || b === null;
    if (aU && bU) return 0;
    if (aU) return 1;
    if (bU) return -1;

    // numbers
    if (typeof a === "number" && typeof b === "number") {
        if (a === b) return 0;
        return a < b ? -1 : 1;
    }

    // dates
    if (a instanceof Date && b instanceof Date) {
        const at = a.getTime();
        const bt = b.getTime();
        if (at === bt) return 0;
        return at < bt ? -1 : 1;
    }

    // fallback string compare
    const as = String(a).toLowerCase();
    const bs = String(b).toLowerCase();
    if (as === bs) return 0;
    return as < bs ? -1 : 1;
}

function mergeStyle(target: AnyStyle, incoming: any) {
    if (!incoming) return;
    const keys = Object.keys(incoming);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = incoming[k];
        if (v !== undefined) {
            target[k] = v;
        }
    }
}

export function AdaptiveTable<T>(props: AdaptiveTableProps<T>) {
    const { tokens } = useAdaptive();
    const { colors, typography, spacing, controls, flags } = tokens;

    const variant: AdaptiveTableVariant =
        props.variant === undefined ? "basic" : props.variant;

    const columns = props.columns;
    const data = props.data;

    const caption = props.caption;
    const emptyMessage = props.emptyMessage === undefined ? "No data available." : props.emptyMessage;

    // Density -> controls padding
    const density = normalizeDensity(props.density);
    // derive from ML spacing if density not explicitly set
    // compact -> smaller; spacious -> bigger
    let basePadY = spacing.padY;
    let basePadX = spacing.padX;
    if (density === "compact") {
        basePadY = Math.max(4, Math.round(basePadY * 0.75));
        basePadX = Math.max(6, Math.round(basePadX * 0.75));
    }
    if (density === "spacious") {
        basePadY = Math.max(10, Math.round(basePadY * 1.4));
        basePadX = Math.max(12, Math.round(basePadX * 1.4));
    }

    const cellPadY = Math.max(4, Math.round(basePadY * 0.9));
    const cellPadX = Math.max(6, Math.round(basePadX * 1.1));

    const borderColor = colors.border;
    const headerBg = flags.highContrast ? colors.surface : colors.surface;
    const zebraBg = flags.theme === "dark" ? "#111111" : "#F3F4F6";

    // Sorting + pagination (only used by sortablePaginated variant, but safe for all)
    const initialSortColumnId =
        props.initialSortColumnId === undefined
            ? (columns.length > 0 ? columns[0].id : "")
            : props.initialSortColumnId;

    const initialSortDirection: SortDirection =
        props.initialSortDirection === undefined ? "asc" : props.initialSortDirection;

    const [sortColumnId, setSortColumnId] = useState<string>(initialSortColumnId);
    const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

    const pageSize = props.pageSize === undefined ? 6 : props.pageSize;
    const [pageIndex, setPageIndex] = useState<number>(0);

    // reset page when data changes
    useEffect(() => {
        setPageIndex(0);
    }, [data]);

    const sortedData: T[] = useMemo(() => {
        if (variant !== "sortablePaginated") return data;

        // find column
        let col: AdaptiveTableColumn<T> | null = null;
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].id === sortColumnId) {
                col = columns[i];
                break;
            }
        }
        if (!col || col.sortable !== true) return data;

        const copied = data.slice(); // ok
        copied.sort((r1, r2) => {
            const v1 = col!.cell ? col!.cell(r1) : getValue(r1, col!.accessor);
            const v2 = col!.cell ? col!.cell(r2) : getValue(r2, col!.accessor);

            // if cell returns ReactNode, sorting is meaningless; fallback to accessor if available
            const a = getValue(r1, col!.accessor);
            const b = getValue(r2, col!.accessor);

            const cmp = compareValues(a, b);
            return sortDirection === "asc" ? cmp : -cmp;
        });

        return copied;
    }, [data, columns, sortColumnId, sortDirection, variant]);

    const pagedData: T[] = useMemo(() => {
        if (variant !== "sortablePaginated") return sortedData;
        const total = sortedData.length;
        const ps = Math.max(1, pageSize);
        const pageCount = Math.max(1, Math.ceil(total / ps));
        const idx = clampNumber(pageIndex, 0, pageCount - 1);
        const start = idx * ps;
        const end = start + ps;
        return sortedData.slice(start, end);
    }, [sortedData, pageIndex, pageSize, variant]);

    const currentRows = variant === "sortablePaginated" ? pagedData : data;

    // pageCount for controls
    const pageCount = useMemo(() => {
        if (variant !== "sortablePaginated") return 1;
        const ps = Math.max(1, pageSize);
        return Math.max(1, Math.ceil(sortedData.length / ps));
    }, [sortedData, pageSize, variant]);

    // --- Styles (loose) ---
    const wrapperStyle: AnyStyle = {
        width: "100%",
        overflowX: "auto",
        border: "1px solid " + borderColor,
        borderRadius: 12,
        backgroundColor: colors.background,
    };
    mergeStyle(wrapperStyle, props.style);

    const tableStyle: AnyStyle = {
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        fontSize: typography.body,
        lineHeight: typography.lineHeight,
        color: colors.text,
    };

    const thStyleBase: AnyStyle = {
        padding: cellPadY.toString() + "px " + cellPadX.toString() + "px",
        backgroundColor: headerBg,
        borderBottom: "1px solid " + borderColor,
        textAlign: "left",
        fontWeight: 600,
        position: "sticky",
        top: 0,
        zIndex: 1,
    };

    const tdStyleBase: AnyStyle = {
        padding: cellPadY.toString() + "px " + cellPadX.toString() + "px",
        borderBottom: "1px solid " + borderColor,
        verticalAlign: "middle",
    };

    // helper to create align style
    function applyAlign(styleObj: AnyStyle, align?: "left" | "center" | "right") {
        if (align === "center") styleObj.textAlign = "center";
        else if (align === "right") styleObj.textAlign = "right";
        else styleObj.textAlign = "left";
    }

    // Sorting header click
    function onHeaderClick(col: AdaptiveTableColumn<T>) {
        if (variant !== "sortablePaginated") return;
        if (col.sortable !== true) return;

        if (sortColumnId === col.id) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortColumnId(col.id);
            setSortDirection("asc");
        }
        setPageIndex(0);
    }

    // Pagination controls sizes adapt to target_size
    const ctrlH = Math.max(controls.minTargetSize, 28);
    const ctrlPadX = Math.max(10, Math.round(ctrlH * 0.4));

    const pagerWrapStyle: AnyStyle = {
        display: "flex",
        gap: Math.max(8, spacing.gapX).toString() + "px",
        alignItems: "center",
        justifyContent: "space-between",
        padding:
            Math.max(10, spacing.pagePaddingY).toString() +
            "px " +
            Math.max(12, spacing.pagePaddingX).toString() +
            "px",
        borderTop: "1px solid " + borderColor,
        backgroundColor: colors.background,
    };

    const pagerBtnStyle: AnyStyle = {
        minHeight: ctrlH,
        minWidth: ctrlH,
        padding: "0 " + ctrlPadX.toString() + "px",
        borderRadius: 9999,
        border: "1px solid " + borderColor,
        backgroundColor: colors.surface,
        color: colors.text,
        cursor: "pointer",
        fontSize: typography.body,
        lineHeight: typography.lineHeight,
        transition: flags.reducedMotion ? "none" : "transform 0.12s ease",
    };

    const pagerBtnDisabledStyle: AnyStyle = {
        cursor: "not-allowed",
        opacity: 0.6,
    };

    // Build <thead>
    const thNodes: any[] = [];
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];

        const thStyle: AnyStyle = {};
        mergeStyle(thStyle, thStyleBase);
        applyAlign(thStyle, col.align);

        if (col.width !== undefined) {
            thStyle.width = col.width;
        }

        const sortable = variant === "sortablePaginated" && col.sortable === true;
        if (sortable) {
            thStyle.cursor = "pointer";
            thStyle.userSelect = "none";
        }

        // Sort indicator
        let label = col.header;
        if (sortable && sortColumnId === col.id) {
            label = col.header + (sortDirection === "asc" ? " ▲" : " ▼");
        } else if (sortable) {
            label = col.header + " ↕";
        }

        const onClick = sortable ? function () { onHeaderClick(col); } : undefined;

        thNodes.push(
            React.createElement(
                "th",
                { key: col.id, style: thStyle, onClick: onClick },
                label
            )
        );
    }

    const theadNode = React.createElement(
        "thead",
        null,
        React.createElement("tr", null, thNodes)
    );

    // Build <tbody>
    const trNodes: any[] = [];

    if (!currentRows || currentRows.length === 0) {
        const tdStyle: AnyStyle = {};
        mergeStyle(tdStyle, tdStyleBase);
        tdStyle.textAlign = "center";
        tdStyle.padding = Math.max(16, spacing.pagePaddingY).toString() + "px";

        trNodes.push(
            React.createElement(
                "tr",
                { key: "empty" },
                React.createElement(
                    "td",
                    { style: tdStyle, colSpan: columns.length },
                    emptyMessage
                )
            )
        );
    } else {
        for (let r = 0; r < currentRows.length; r++) {
            const row = currentRows[r];

            const tdCells: any[] = [];
            for (let c = 0; c < columns.length; c++) {
                const col = columns[c];

                const tdStyle: AnyStyle = {};
                mergeStyle(tdStyle, tdStyleBase);
                applyAlign(tdStyle, col.align);

                // zebra
                // zebra rows for all variants except "basic"
                if (variant !== "basic" && r % 2 === 1) {
                    tdStyle.backgroundColor = zebraBg;
                }


                // cell content
                let content: any = null;

                // image column
                if (variant === "withImages" && col.isImage === true) {
                    const src = getValue(row, col.accessor);
                    const alt = getValue(row, col.imageAltAccessor);
                    const sizePx = col.imageSize !== undefined ? col.imageSize : Math.max(controls.minTargetSize, 32);
                    const radius = col.imageShape === "circle" ? 9999 : 8;

                    const imgStyle: AnyStyle = {
                        width: sizePx,
                        height: sizePx,
                        objectFit: "cover",
                        borderRadius: radius,
                        border: "1px solid " + borderColor,
                        display: "block",
                    };

                    content = React.createElement("img", {
                        src: src,
                        alt: alt || "",
                        style: imgStyle,
                    });
                } else if (col.cell) {
                    content = col.cell(row);
                } else {
                    const v = getValue(row, col.accessor);
                    content = v === undefined || v === null ? "" : String(v);
                }

                // Make the cell target size friendlier if it's a clickable / interactive cell later
                tdStyle.minHeight = controls.minTargetSize;

                tdCells.push(
                    React.createElement(
                        "td",
                        { key: col.id + ":" + r.toString(), style: tdStyle },
                        content
                    )
                );
            }

            const rowStyle: AnyStyle = {};
            // Optional row hover styling
            if (!flags.reducedMotion) {
                rowStyle.transition = "background-color 0.12s ease";
            }

            const key = getRowKey(row, r, props.rowKey);

            trNodes.push(React.createElement("tr", { key: key, style: rowStyle }, tdCells));
        }
    }

    const tbodyNode = React.createElement("tbody", null, trNodes);

    // caption (optional)
    let captionNode: any = null;
    if (caption) {
        const capStyle: AnyStyle = {
            captionSide: "top",
            textAlign: "left",
            padding:
                Math.max(10, spacing.pagePaddingY).toString() +
                "px " +
                Math.max(12, spacing.pagePaddingX).toString() +
                "px",
            fontSize: typography.body,
            color: colors.text,
            fontWeight: 600,
        };
        captionNode = React.createElement("caption", { style: capStyle }, caption);
    }

    const tableNode = React.createElement(
        "table",
        {
            style: tableStyle,
            "aria-label": props.ariaLabel || caption || "Adaptive table",
            role: "table",
        } as any,
        captionNode,
        theadNode,
        tbodyNode
    );

    // Pagination controls node (only for sortablePaginated)
    let pagerNode: any = null;
    if (variant === "sortablePaginated") {
        const idx = clampNumber(pageIndex, 0, pageCount - 1);

        const prevDisabled = idx <= 0;
        const nextDisabled = idx >= pageCount - 1;

        const prevStyle: AnyStyle = {};
        mergeStyle(prevStyle, pagerBtnStyle);
        if (prevDisabled) mergeStyle(prevStyle, pagerBtnDisabledStyle);

        const nextStyle: AnyStyle = {};
        mergeStyle(nextStyle, pagerBtnStyle);
        if (nextDisabled) mergeStyle(nextStyle, pagerBtnDisabledStyle);

        const infoStyle: AnyStyle = {
            fontSize: typography.body,
            lineHeight: typography.lineHeight,
            color: colors.text,
        };

        const leftGroupStyle: AnyStyle = {
            display: "flex",
            gap: Math.max(8, spacing.gapX).toString() + "px",
            alignItems: "center",
        };

        const onPrev = prevDisabled ? undefined : function () { setPageIndex(idx - 1); };
        const onNext = nextDisabled ? undefined : function () { setPageIndex(idx + 1); };

        pagerNode = React.createElement(
            "div",
            { style: pagerWrapStyle },
            React.createElement(
                "div",
                { style: leftGroupStyle },
                React.createElement("button", { style: prevStyle, onClick: onPrev, disabled: prevDisabled } as any, "Prev"),
                React.createElement("button", { style: nextStyle, onClick: onNext, disabled: nextDisabled } as any, "Next")
            ),
            React.createElement(
                "div",
                { style: infoStyle },
                "Page ",
                String(idx + 1),
                " of ",
                String(pageCount)
            )
        );
    }

    // Wrapper props
    const wrapperProps: any = {
        style: wrapperStyle,
        className: "adaptive-table " + (props.className === undefined ? "" : props.className),
    };

    // Build final layout:
    // wrapper -> table + (pager if needed)
    if (pagerNode) {
        return React.createElement("div", wrapperProps, tableNode, pagerNode);
    }
    return React.createElement("div", wrapperProps, tableNode);
}
