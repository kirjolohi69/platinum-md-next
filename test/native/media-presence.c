/* Protocol oracle: asivery/netmd-js src/netmd-interface.ts, git blob
 * 3c6bdbcca0150147956cdc623b5110acec4f6b3a (retrieved 2026-09-23).
 * https://github.com/asivery/netmd-js/blob/master/src/netmd-interface.ts
 * isDiscPresent compares payload[4] with 0x40, with no zero-only absence rule;
 * changeDescriptorState tolerates command rejection. These are synthetic
 * replies, not a capture of the user's recorder. Transport failures remain
 * fatal here even though upstream catches all descriptor exceptions.
 * SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "playercontrol.h"
#include "log.h"
#include "const.h"

static const unsigned char request[] = {0x00,0x18,0x09,0x80,0x01,0x02,0x30,0x88,
    0x00,0x00,0x30,0x88,0x04,0x00,0xff,0x00,0x00,0x00,0x00,0x00};
static const unsigned char valid[] = {0x09,0x18,0x09,0x80,0x01,0x02,0x30,0x88,
    0x00,0x00,0x30,0x88,0x04,0x00,0x10,0x00,0x00,0x09,0x00,0x00,
    0x00,0x07,0x00,0x05,0x88,0x04,0x40,0x00,0x00};
static unsigned char reply[255];
static int calls, reply_length, open_length, close_length, open_status, close_status, cases;

int netmd_exch_message(netmd_dev_handle *dev, unsigned char *cmd, const size_t length, unsigned char *out) {
    (void)dev; calls++;
    if (calls == 2) {
        assert(length == sizeof(request) && memcmp(cmd, request, length) == 0);
        if (reply_length > 0) memcpy(out, reply, (size_t)reply_length);
        return reply_length;
    }
    assert(calls == 1 || calls == 3);
    unsigned char descriptor[] = {0x00,0x18,0x08,0x80,0x00,calls == 1 ? 0x01 : 0x00,0x00};
    assert(length == sizeof(descriptor) && memcmp(cmd, descriptor, length) == 0);
    memcpy(out, descriptor, sizeof(descriptor));
    out[0] = calls == 1 ? open_status : close_status;
    return calls == 1 ? open_length : close_length;
}
static void reset(void) {
    calls=0; reply_length=sizeof(valid); open_length=close_length=7;
    open_status=close_status=NETMD_STATUS_ACCEPTED;
    memset(reply,0,sizeof(reply)); memcpy(reply,valid,sizeof(valid));
}
static void check(netmd_error expected, int expected_present, int expected_calls) {
    int present=99;
    assert(netmd_get_disc_presence(NULL,&present)==expected);
    assert(present==expected_present && calls==expected_calls); cases++;
}
int main(void) {
    netmd_set_log_level(NETMD_LOG_NONE);
    reset(); check(NETMD_NO_ERROR,1,3);
    reset(); reply[26]=0; check(NETMD_NO_ERROR,0,3);
    reset(); reply[0]=NETMD_STATUS_IMPLEMENTED; check(NETMD_NO_ERROR,1,3);
    reset(); reply_length=26; check(NETMD_RESPONSE_TO_SHORT,99,3);
    reset(); reply_length=0; check(NETMD_RESPONSE_TO_SHORT,99,3);
    reset(); reply_length=NETMDERR_USB; check(NETMD_USB_ERROR,99,2);
    reset(); reply[0]=NETMD_STATUS_REJECTED; check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    reset(); reply[12]=0x03; check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    reset(); reply[21]=6; check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    /* Every non-0x40 value means not present in the upstream implementation.
     * This regression fails on alpha.9 before any descriptor changes. */
    for (unsigned int flag=0; flag<256; flag++) {
        reset(); reply[26]=(unsigned char)flag;
        check(NETMD_NO_ERROR,flag==0x40,3);
    }
    reset(); open_length=NETMDERR_TIMEOUT; check(NETMD_USB_ERROR,99,1);
    reset(); open_status=NETMD_STATUS_REJECTED; check(NETMD_NO_ERROR,1,3);
    reset(); open_status=NETMD_STATUS_NOT_IMPLEMENTED; reply[26]=0x80; check(NETMD_NO_ERROR,0,3);
    reset(); close_length=NETMDERR_TIMEOUT; check(NETMD_USB_ERROR,99,3);
    reset(); close_status=NETMD_STATUS_REJECTED; check(NETMD_NO_ERROR,1,3);
    reset(); close_status=NETMD_STATUS_NOT_IMPLEMENTED; reply[26]=0x80; check(NETMD_NO_ERROR,0,3);
    reset(); open_status=close_status=NETMD_STATUS_REJECTED; reply[26]=0x80; check(NETMD_NO_ERROR,0,3);
    /* Declining descriptor housekeeping never excuses a bad status reply. */
    reset(); open_status=close_status=NETMD_STATUS_REJECTED; reply[0]=NETMD_STATUS_REJECTED;
    check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    reset(); close_status=NETMD_STATUS_REJECTED; reply[21]=6; check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    reset(); open_status=NETMD_STATUS_REJECTED; reply_length=NETMDERR_USB; check(NETMD_USB_ERROR,99,2);
    reset(); open_length=0; check(NETMD_RESPONSE_TO_SHORT,99,1);
    reset(); close_length=0; check(NETMD_RESPONSE_TO_SHORT,99,3);
    reset(); open_status=0x7f; check(NETMD_RESPONSE_NOT_EXPECTED,99,1);
    reset(); close_status=0x7f; check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    reset(); reply[0]=NETMD_STATUS_NOT_IMPLEMENTED; check(NETMD_RESPONSE_NOT_EXPECTED,99,3);
    /* A shorter valid payload still contains byte 4; a truncated one does not. */
    reset(); reply[21]=5; reply_length=27; check(NETMD_NO_ERROR,1,3);
    reset(); reply[21]=4; reply_length=26; check(NETMD_RESPONSE_TO_SHORT,99,3);
    printf("Native disc presence: %d cases passed.\n",cases);
}
