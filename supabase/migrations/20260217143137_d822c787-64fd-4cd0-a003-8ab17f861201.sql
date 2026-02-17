INSERT INTO public.permission_definitions (code, name, description, module, resource, action)
VALUES ('platform.menu_structure.manage', 'Gerenciar Estrutura de Menus', 'Permite reorganizar a estrutura de menus da plataforma via drag-and-drop', 'plataforma', 'menu_structure', 'manage')
ON CONFLICT (code) DO NOTHING;