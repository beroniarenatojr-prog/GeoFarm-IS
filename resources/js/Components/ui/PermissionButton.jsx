import { usePermissions } from '@/hooks/usePermissions';

export default function PermissionButton({ permission, children, ...props }) {
    const { can } = usePermissions();
    
    if (!can(permission)) {
        return null;
    }
    
    return <button {...props}>{children}</button>;
}

export function PermissionLink({ permission, children, ...props }) {
    const { can } = usePermissions();
    
    if (!can(permission)) {
        return null;
    }
    
    // Assuming Link is passed as a component
    const { component: Component = 'a', ...restProps } = props;
    return <Component {...restProps}>{children}</Component>;
}
