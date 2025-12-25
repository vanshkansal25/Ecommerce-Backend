export const buildTree = (items: any[], parentId: string | null = null): any[] => {
    if (items.length === 0) {
        return [];
    }
    return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
            ...item,
            children: buildTree(items, item.id)
        }));
};