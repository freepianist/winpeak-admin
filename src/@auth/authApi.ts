import { User } from '@auth/user';
import UserModel from '@auth/user/models/UserModel';
import { PartialDeep } from 'type-fest';

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status });
}

/**
 * Mock user APIs were removed. Settings live on the Auth.js session.
 */
export async function authGetDbUser(_userId: string): Promise<Response> {
	return json({ message: 'Not found' }, 404);
}

export async function authGetDbUserByEmail(_email: string): Promise<Response> {
	return json({ message: 'User not found' }, 404);
}

export function authUpdateDbUser(user: PartialDeep<User>) {
	return json(UserModel(user), 200);
}

export async function authCreateDbUser(_user: PartialDeep<User>) {
	return json({ message: 'Not found' }, 404);
}
