import { useState, useRef, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { Eye, Pencil, Trash2, MoreVertical, Lock, Unlock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

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
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label="Actions"
                aria-expanded={isOpen}
            >
                <MoreVertical className="h-4 w-4" />
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                >
                    {children || validActions.map((action, index) => (
                        <ActionMenuItem
                            key={index}
                            {...action}
                            onClose={() => setIsOpen(false)}
                        />
                    ))}
                </div>
            )}
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
        default: 'text-gray-700 hover:bg-gray-50',
        danger: 'text-red-600 hover:bg-red-50',
        warning: 'text-amber-600 hover:bg-amber-50',
    };

    const baseClasses = `flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
        disabled 
            ? 'text-gray-300 cursor-not-allowed' 
            : variantClasses[variant]
    }`;

    const content = (
        <>
            {Icon && <Icon className="h-4 w-4" />}
            <span>{label}</span>
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
            className={`${baseClasses} w-full text-left`}
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
