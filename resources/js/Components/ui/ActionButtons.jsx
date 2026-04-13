import { Link } from '@inertiajs/react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export function ViewButton({ href, permission = 'view', title = "View" }) {
    const { can } = usePermissions();
    
    if (permission && !can(permission)) {
        return null;
    }
    
    return (
        <Link 
            href={href}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
            title={title}
        >
            <Eye className="h-4 w-4" />
        </Link>
    );
}

export function EditButton({ href, permission = 'edit', title = "Edit" }) {
    const { can } = usePermissions();
    
    if (permission && !can(permission)) {
        return null;
    }
    
    return (
        <Link 
            href={href}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
            title={title}
        >
            <Pencil className="h-4 w-4" />
        </Link>
    );
}

export function DeleteButton({ href, onConfirm, permission = 'delete', title = "Delete" }) {
    const { can } = usePermissions();
    
    if (permission && !can(permission)) {
        return null;
    }
    
    const handleClick = (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to delete this item?')) {
            if (onConfirm) {
                onConfirm();
            }
        }
    };

    return (
        <button
            onClick={handleClick}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title={title}
        >
            <Trash2 className="h-4 w-4" />
        </button>
    );
}

export function ActionButtons({ viewHref, editHref, onDelete, viewPermission, editPermission, deletePermission, showView = true, showEdit = true, showDelete = true }) {
    return (
        <div className="flex items-center gap-2">
            {showView && viewHref && <ViewButton href={viewHref} permission={viewPermission} />}
            {showEdit && editHref && <EditButton href={editHref} permission={editPermission} />}
            {showDelete && <DeleteButton onConfirm={onDelete} permission={deletePermission} />}
        </div>
    );
}
