import { usePage } from '@inertiajs/react';

export function usePermissions() {
    const { auth } = usePage().props;
    const permissions = auth?.permissions || [];

    const can = (permission) => {
        return permissions.includes(permission);
    };

    const canAny = (...permissionList) => {
        return permissionList.some(permission => permissions.includes(permission));
    };

    const canAll = (...permissionList) => {
        return permissionList.every(permission => permissions.includes(permission));
    };

    return { can, canAny, canAll, permissions };
}
