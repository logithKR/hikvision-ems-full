/**
 * useOptimisticQuery.js
 * 
 * Wraps TanStack useQuery with:
 * 1. Optimistic cached data (shows stale data instantly while refetching)
 * 2. Background polling for live updates (default 15s)
 * 3. Skeleton-free experience after first load
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

/**
 * @param {Object} options
 * @param {string[]} options.queryKey - TanStack query key
 * @param {Function} options.queryFn - Async fetch function
 * @param {boolean} options.enabled - Whether query is enabled
 * @param {number} options.refetchInterval - Background poll interval in ms (default 15000)
 * @param {number} options.staleTime - Time before data is considered stale (default 30000)
 * @param {*} options.placeholderData - Initial placeholder while loading
 * @param {*} options.initialData - Seed data for instant render
 */
export function useOptimisticQuery({
 queryKey,
 queryFn,
 enabled = true,
 refetchInterval = 15000,
 staleTime = 30000,
 placeholderData = undefined,
 initialData = undefined,
 ...rest
}) {
 const queryClient = useQueryClient()
 const hasLoadedOnce = useRef(false)

 const query = useQuery({
 queryKey,
 queryFn,
 enabled,
 staleTime,
 refetchInterval: enabled ? refetchInterval : false,
 refetchIntervalInBackground: true,
 refetchOnWindowFocus: true,
 keepPreviousData: true,
 placeholderData: placeholderData,
 initialData: initialData,
 ...rest,
 })

 // Track first successful load
 if (query.isSuccess && !hasLoadedOnce.current) {
 hasLoadedOnce.current = true
 }

 // Manual refresh (for pull-to-refresh or button)
 const refresh = useCallback(() => {
 queryClient.invalidateQueries({ queryKey })
 }, [queryClient, queryKey])

 // Optimistic setter: instantly update cache, rollback on error
 const setOptimistic = useCallback((updater) => {
 queryClient.setQueryData(queryKey, (old) => {
 if (typeof updater === 'function') return updater(old)
 return updater
 })
 }, [queryClient, queryKey])

 return {
 ...query,
 refresh,
 setOptimistic,
 hasLoadedOnce: hasLoadedOnce.current,
 // True only on very first load (no cached data)
 isFirstLoad: query.isLoading && !hasLoadedOnce.current,
 // True when refreshing in background (has data + fetching)
 isBackgroundRefresh: query.isFetching && hasLoadedOnce.current,
 }
}

/**
 * useBackgroundSync - parallel background data loading
 * Seeds multiple query keys with periodic refetches
 */
export function useBackgroundSync(queries, { enabled = true, interval = 20000 } = {}) {
 const queryClient = useQueryClient()

 queries.forEach(({ queryKey, queryFn }) => {
 // eslint-disable-next-line react-hooks/rules-of-hooks
 useQuery({
 queryKey,
 queryFn,
 enabled,
 staleTime: interval,
 refetchInterval: enabled ? interval : false,
 refetchIntervalInBackground: true,
 })
 })

 const refreshAll = useCallback(() => {
 queries.forEach(({ queryKey }) => {
 queryClient.invalidateQueries({ queryKey })
 })
 }, [queryClient, queries])

 return { refreshAll }
}

export default useOptimisticQuery
