import { useSession, signOut } from 'next-auth/react';
import { useMemo } from 'react';
import { User } from '@auth/user';
import _ from 'lodash';
import setIn from '@/utils/setIn';

type useUser = {
	data: User | null;
	isGuest: boolean;
	updateUser: (updates: Partial<User>) => Promise<User | undefined>;
	updateUserSettings: (newSettings: User['settings']) => Promise<User['settings'] | undefined>;
	signOut: () => Promise<void>;
};

function useUser(): useUser {
	const { data, update } = useSession();
	const user = useMemo(() => data?.db, [data]);
	const isGuest = useMemo(() => !user?.role || user?.role?.length === 0, [user]);

	async function handleUpdateUser(_data: Partial<User>) {
		const merged = { ...user, ..._data } as User;
		await update(merged);
		return merged;
	}

	async function handleUpdateUserSettings(newSettings: User['settings']) {
		const newUser = setIn(user, 'settings', newSettings) as User;

		if (_.isEqual(user, newUser)) {
			return undefined;
		}

		const updatedUser = await handleUpdateUser(newUser);

		return updatedUser?.settings;
	}

	async function handleSignOut() {
		return signOut();
	}

	return {
		data: user,
		isGuest,
		signOut: handleSignOut,
		updateUser: handleUpdateUser,
		updateUserSettings: handleUpdateUserSettings
	};
}

export default useUser;
