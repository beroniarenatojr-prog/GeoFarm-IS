import { useState, useRef, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { Eye, Pencil, Trash2, MoreVertical, Lock, Unlock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import AnchoredList from './AnchoredList';

/**
 * Dropdown menu with 3-dot button for actions
 * Consolidates View, Edit, Delete, and custom actions into a dropdown
 */
export function ActionMenu({ actions = [], children }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Filter out null/undefined actions
    const validActions = actions.filter(Boolean);

    if (validActions.length === 0 && !children) {
        return null;
    }

    return (
        <div className="relative inline-block">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-all hover:shadow-sm"
                aria-label="Actions"
                aria-expanded={isOpen}
            >
                <MoreVertical className="h-4 w-4" />
            </button>

            {/*
                Portalled out of the table, not absolutely positioned inside it.

                An absolute child of a scrolling container is clipped at its
                edge, and every table this menu appears in sits in an
                overflow-x-auto wrapper — so the menu was cut off, with Delete
                unreachable on the last rows. AnchoredList moves it to <body>
                and positions it fixed against the button, which nothing can
                clip, and keeps it tracking the button as the page scrolls.

                Right-aligned and not width-matched: the anchor is a 32 px icon
                button, so matching its width would give a 32 px menu.
            */}
            <AnchoredList
                anchorRef={buttonRef}
                open={isOpen}
                align="right"
                matchWidth={false}
                maxHeight={360}
            >
                <div
                    ref={menuRef}
                    className="min-w-[200px] w-max rounded-xl border border-gray-200 bg-white py-2 shadow-xl"
                >
                    {children || validActions.map((action, index) => (
                        <ActionMenuItem
                            key={index}
                            {...action}
                            onClose={() => setIsOpen(false)}
                        />
                    ))}
                </div>
            </AnchoredList>
        </div>
    );
}

function ActionMenuItem({ 
    label, 
    icon: Icon, 
    href, 
    onClick, 
    permission, 
    disabled = false, 
    disabledTitle,
    variant = 'default',
    onClose 
}) {
    const { can } = usePermissions();

    // Check permission
    if (permission && !can(permission)) {
        return null;
    }

    const variantClasses = {
        default: 'text-gray-700 hover:bg-green-50 hover:text-green-700',
        danger: 'text-red-600 hover:bg-red-100',
        warning: 'text-amber-600 hover:bg-amber-100',
    };

    /*
         * `w-full text-left` belongs here, not only on the button.
         *
         * It used to be added to the <button> branch alone, so an item with an
         * href — View, Edit — rendered as a <Link> without it and INHERITED
         * text-align from the cell it was in. The Actions column is
         * right-aligned, so "View" sat hard against the right edge of the menu
         * while "Edit" sat beside its icon: two items in one list, aligned
         * differently, for no reason a reader could see.
         */
    const baseClasses = `flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-all whitespace-nowrap ${
        disabled
            ? 'text-gray-300 cursor-not-allowed bg-gray-50'
            : variantClasses[variant]
    }`;

    const iconClasses = disabled 
        ? 'h-4 w-4 text-gray-300' 
        : variant === 'danger' 
            ? 'h-4 w-4 text-red-500' 
            : variant === 'warning'
                ? 'h-4 w-4 text-amber-500'
                : 'h-4 w-4 text-green-600';

    const content = (
        <>
            {Icon && <Icon className={iconClasses} />}
            <span className="flex-1">{label}</span>
        </>
    );

    const handleClick = (e) => {
        if (disabled) {
            e.preventDefault();
            return;
        }
        if (onClick) {
            e.preventDefault();
            onClick();
            onClose();
        } else if (href) {
            onClose();
        }
    };

    if (href && !disabled) {
        return (
            <Link
                href={href}
                className={baseClasses}
                title={disabledTitle}
                onClick={handleClick}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={baseClasses}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
        >
            {content}
        </button>
    );
}

/**
 * Pre-configured action menu with common actions (View, Edit, Delete)
 */
export function StandardActionMenu({
    viewHref,
    editHref,
    editOnClick,
    onDelete,
    viewPermission,
    editPermission,
    deletePermission,
    showView = true,
    showEdit = true,
    showDelete = true,
    editDisabled = false,
    deleteDisabled = false,
    editDisabledTitle = "Not available",
    deleteDisabledTitle = "Not available",
    customActions = [],
}) {
    const actions = [];

    if (showView && viewHref) {
        actions.push({
            label: 'View',
            icon: Eye,
            href: viewHref,
            permission: viewPermission,
        });
    }

    if (showEdit && (editHref || editOnClick)) {
        actions.push({
            label: 'Edit',
            icon: Pencil,
            href: editHref,
            onClick: editOnClick,
            permission: editPermission,
            disabled: editDisabled,
            disabledTitle: editDisabledTitle,
        });
    }

    if (showDelete) {
        actions.push({
            label: 'Delete',
            icon: Trash2,
            onClick: onDelete ? () => {
                if (confirm('Are you sure you want to delete this item?')) {
                    onDelete();
                }
            } : undefined,
            permission: deletePermission,
            variant: 'danger',
            disabled: deleteDisabled,
            disabledTitle: deleteDisabledTitle,
        });
    }

    // Add custom actions (e.g., Lock/Unlock)
    actions.push(...customActions.filter(Boolean));

    return <ActionMenu actions={actions} />;
}

export default ActionMenu;
