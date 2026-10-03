/* Synthetic protocol fixtures, not a capture from the user's recorder.
 * The 46-byte layout follows linux-minidisc's DecodeDiscCapacityReply and
 * Python getDiscCapacity. Exercise the production C parser with a USB stub.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "playercontrol.h"
#include "log.h"
#include "const.h"

static const unsigned char valid_reply[] = {
    0x09, 0x18, 0x06, 0x02, 0x10, 0x10, 0x00, 0x30, 0x80, 0x03,
    0x00, 0x10, 0x00, 0x00, 0x1d, 0x00, 0x00, 0x00, 0x1b, 0x80,
    0x03, 0x00, 0x17, 0x80, 0x00,
    0x00, 0x05, 0x00, 0x00, 0x12, 0x34, 0x56,
    0x00, 0x05, 0x00, 0x01, 0x20, 0x00, 0x00,
    0x00, 0x05, 0x00, 0x01, 0x07, 0x25, 0x44
};
static unsigned char response[255];
static int handshake_length, response_length, calls;

int netmd_exch_message(netmd_dev_handle *dev, unsigned char *cmd,
                       const size_t cmdlen, unsigned char *rsp)
{
    (void)dev;
    calls++;
    if (calls == 1) {
        assert(cmdlen == 8 && cmd[2] == 0x08);
        if (handshake_length > 0) rsp[0] = NETMD_STATUS_ACCEPTED;
        return handshake_length;
    }
    assert(calls == 2 && cmdlen == 17 && cmd[2] == 0x06);
    if (response_length > 0) memcpy(rsp, response, (size_t)response_length);
    return response_length;
}

static void reset(void)
{
    memset(response, 0, sizeof(response));
    memcpy(response, valid_reply, sizeof(valid_reply));
    calls = 0;
    handshake_length = 8;
    response_length = (int)sizeof(valid_reply);
}

static void check_success(void)
{
    netmd_disc_capacity capacity = {0};
    assert(netmd_get_disc_capacity(NULL, &capacity) == NETMD_NO_ERROR);
    assert(calls == 2);
    assert(capacity.recorded.hour == 0 && capacity.recorded.minute == 12 &&
           capacity.recorded.second == 34 && capacity.recorded.frame == 56);
    assert(capacity.total.hour == 1 && capacity.total.minute == 20 &&
           capacity.total.second == 0 && capacity.total.frame == 0);
    assert(capacity.available.hour == 1 && capacity.available.minute == 7 &&
           capacity.available.second == 25 && capacity.available.frame == 44);
}

static void check_failure(netmd_error expected, int expected_calls)
{
    netmd_disc_capacity capacity, unchanged;
    memset(&capacity, 0xa5, sizeof(capacity));
    memcpy(&unchanged, &capacity, sizeof(capacity));
    assert(netmd_get_disc_capacity(NULL, &capacity) == expected);
    assert(calls == expected_calls);
    assert(memcmp(&capacity, &unchanged, sizeof(capacity)) == 0);
}

int main(void)
{
    netmd_set_log_level(NETMD_LOG_NONE);
    assert(sizeof(valid_reply) == 46);
    reset(); check_success();
    reset(); response_length = 48; check_success();
    reset(); response_length = 45; check_failure(NETMD_RESPONSE_TO_SHORT, 2);
    reset(); response_length = NETMDERR_TIMEOUT; check_failure(NETMD_USB_ERROR, 2);
    reset(); handshake_length = NETMDERR_USB; check_failure(NETMD_USB_ERROR, 1);
    reset(); handshake_length = 0; check_failure(NETMD_USB_ERROR, 1);
    reset(); response[0] = NETMD_STATUS_REJECTED; check_failure(NETMD_RESPONSE_NOT_EXPECTED, 2);
    reset(); response[33] = 4; check_failure(NETMD_RESPONSE_NOT_EXPECTED, 2);
    puts("Native capacity reader: 8 protocol cases passed.");
    return 0;
}
