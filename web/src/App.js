import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SendSmsPage } from '@/pages/SendSmsPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { ListsPage } from '@/pages/ListsPage';
import { ListDetailPage } from '@/pages/ListDetailPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { CampaignDetailPage } from '@/pages/CampaignDetailPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { getToken } from '@/api/client';
function RequireAuth({ children }) {
    if (!getToken())
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(_Fragment, { children: children });
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(Layout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "send", element: _jsx(SendSmsPage, {}) }), _jsx(Route, { path: "contacts", element: _jsx(ContactsPage, {}) }), _jsx(Route, { path: "lists", element: _jsx(ListsPage, {}) }), _jsx(Route, { path: "lists/:id", element: _jsx(ListDetailPage, {}) }), _jsx(Route, { path: "campaigns", element: _jsx(CampaignsPage, {}) }), _jsx(Route, { path: "campaigns/:id", element: _jsx(CampaignDetailPage, {}) }), _jsx(Route, { path: "devices", element: _jsx(DevicesPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/" }) })] }));
}
