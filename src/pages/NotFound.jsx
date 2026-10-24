import { Link } from "react-router-dom";

const NotFound = () => (
  <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-6 text-center text-white">
    <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">404 · Page not found</p>
    <h1 className="mt-3 text-3xl font-bold">This page does not exist</h1>
    <p className="mt-3 max-w-md text-gray-400">
      The address may be incorrect, or the page may have moved. Return to the home page to choose a workspace.
    </p>
    <Link
      to="/"
      className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
    >
      Back to home
    </Link>
  </main>
);

export default NotFound;
